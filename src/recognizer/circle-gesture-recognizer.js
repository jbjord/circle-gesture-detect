import PointSample from "../model/point-sample";
import SampleLog from "../model/sample-log.js";

/**
 * @typedef {Object} RejectionReason
 * @property {string} code - Stable machine-readable reason code.
 * @property {string} message - Human-readable rejection message.
 */

/**
 * A single rejection rule.
 * @typedef {Object} RejectionRule
 * @property {(self: CircleGestureRecognizer) => boolean} test
 *   Predicate that returns true when the rule should fire.
 * @property {RejectionReason} reason
 *   The rejection payload returned when the rule matches.
 */


export default class CircleGestureRecognizer {
    static POSSIBLE_STATES = [
        "idle",
        "tooEarly",
        "possibleCircle", 
        "circleLikely", 
        "circleComplete", 
        "notCircle"
    ];

    /**
     * Lookup table of rejection reasons.
     * @type {RejectionReason}
     * @private
     * @static
     */
    static #REASONS = {
        tooBig: {
            code: "tooBig",
            message: "Gesture is too big"
        },
        tooManyReversals: {
            code: "tooManyReversals",
            message: "Gesture has too many reversals"
        },
        unstableRadius: {
            code: "unstableRadius",
            message: "Radius deviation too high"
        },
        notEnoughSweep: {
            code: "notEnoughSweep",
            message: "Not enough angular sweep"
        }
    };

    /**
     * Declarative rejection rules organized by state and phase.
     *
     * Structure:
     * {
     *   [state: string]: {
     *     ADD: RejectionRule[],
     *     END: RejectionRule[]
     *   }
     * }
     *
     * @type {Object<string, {ADD: RejectionRule[], END: RejectionRule[]}>}
     * @private
     * @static
     */
    static #REJECTION_RULES = {
        possibleCircle: {
            ADD: [
                { test: s => s.#isTooBig(), reason: CircleGestureRecognizer.#REASONS.tooBig },
                { test: s => s.#hasTooManyBacktracks(), reason: CircleGestureRecognizer.#REASONS.tooManyReversals }
            ],
            END: [
                { test: s => s.#isTooBig(), reason: CircleGestureRecognizer.#REASONS.tooBig },
                { test: s => s.#hasTooManyBacktracks(), reason: CircleGestureRecognizer.#REASONS.tooManyReversals }
            ]
        },

        circleLikely: {
            ADD: [
                { test: s => s.#isTooBig(), reason: CircleGestureRecognizer.#REASONS.tooBig },
                { test: s => s.#hasTooManyBacktracks(), reason: CircleGestureRecognizer.#REASONS.tooManyReversals },
                { test: s => s.#radiusDeviationTooHigh(), reason: CircleGestureRecognizer.#REASONS.unstableRadius }
            ],
            END: [
                { test: s => s.#isTooBig(), reason: CircleGestureRecognizer.#REASONS.tooBig },
                { test: s => s.#hasTooManyBacktracks(), reason: CircleGestureRecognizer.#REASONS.tooManyReversals },
                { test: s => s.#radiusDeviationTooHigh(), reason: CircleGestureRecognizer.#REASONS.unstableRadius },
                { test: s => !s.#hasCompleteAngularSweep(), reason: CircleGestureRecognizer.#REASONS.notEnoughSweep }
            ]
        }
    };



    /**
     * Constructs state machine for live tracking a gesture.
     * @param {CircleGestureThresholds} thresholds 
     */
    constructor(thresholds) {
        this.thresholds = thresholds;

        /**@type {SampleLog|null} */
        this.log = null
        this.state = "this.states.idle";
        //FUTURE: this.state = "idle";

        /**
         * Details for an event to be dispatched.
         * Will be populated when gesture is definitely detected.
         * @type {object} - details to publish along with the event.
         */
        this.eventDetail = {};
    }

    /**
     * Send information to the State Machine to take action and change state
     * as appropriate.
     * @param {"START"|"POINT_ADDED"|"END"} type - the type of call 
     * @param {Object} payload - the payload for the call
     * @returns {null}
     * @todo Build logic
     * 
     * | type       | payload
     * | ---------- | -------------------------------------------------------- |
     * | START      | @type {PointSample} {x, y, t} |
     * | ADD_POINT  | @type {PointSample} {x, y, t} |
     * | END        | @type {PointSample} {x, y, t} |
     */
    send(type, payload={}) {
        const currentState = this.smDefinition[this.state];
        const transition = currentState?.on?.[type];
        if (!transition) return;

        const choices = Array.isArray(transition) ? transition : [transition];

        for (const t of choices) {
            if (!t.guard || t.guard(this, payload)) {
                //todo
                //state machine runner
                //1. receive current state + event (above)
                //2. apply event-level update if appropriate
                //3. select the first matching transition by guard
                //4. gather/call any declared effects from that transition
                //5. return info about state, changed, effects
            }
        }

    }

    /***************************************************************************
     * Mapping Registries
     **************************************************************************/
    guardHandlers = {
        shouldLeaveTooEarly: () => this.#shouldLeaveTooEarly(),
        shouldRejectPossibleCircle: () => this.#shouldRejectPossibleCircle(),
        shouldPromotePossibleCircle: () => this.#shouldPromotePossibleCircle(),
        shouldRejectCircleLikely: () => this.#shouldRejectCircleLikely(),
//        meetsAllCircularityChecks: (event) => this.#meetsAllCircularityChecks(event)
    };

    updateHandlers = {
        addPoint: (x, y, t) => this.#addPoint(x, y, t)
    };

    effectHandlers = {
        initializeSampleLog: (x, y, t) => this.#initializeSampleLog(x, y, t),
        getRejectionReason: (state, phase) => this.#getRejectionReasonFor(state, phase),
    };

    /**
     * State Machine Definition
     * As the gesture continues, points get added and the state machine follows
     * this flow:
     * idle → tooEarly → possibleCircle → circleLikely → circle detected/rejected
     *                 ↳ rejected        ↳ rejected 
     * 
     * If the gesture ends, it is classified if appropriate and the state
     * returns to the idle state.
     * 
     * ## Runner convention
     *  - target: null means remain in the current state
     *  - update runs before transition guards are evaluated
     *  - first matching guarded transition wins
     *  - effects are to be collected by the runner and returned to caller
     * 
     * @todo build out targets, effects, and guards
     */
    smDefinition = {
        initial: "idle",
        states: {

            /**
             * "idle": waiting for a gesture that can be tracked.
             */
            idle: { 
                on: {
                    START: {
                        effects: ["initializeSampleLog"],
                        target: "tooEarly"
                    }
                }
            },

            /**
             * "tooEarly": gesture logging has started but there are not yet enough 
             * points to make any decisions.
             */
            tooEarly: {
                on: {
                    POINT_ADDED: {
                        update: "addPoint",
                        transitions: [
                            {
                                guard: "shouldLeaveTooEarly",
                                target: "possibleCircle",
                            },
                            {
                                target: null
                            }
                        ]
                        
                    },
                    END: {
                        effects: ["report Reject 'too little evidence'"],
                        target: "idle"
                    }
                }
            },

            /**
             * "possibleCircle": there are not yet enough points to calculate a
             * stable centroid.
             */
            possibleCircle: {
                on: {
                    POINT_ADDED: {
                        update: "addPoint",
                        transitions: [
                            {
                                guard: "shouldRejectPossibleCircle",
                                effects: [
                                    "getRejectionReason",
                                    "todo: report circle rejected"
                                ],
                                target: "idle"
                            },
                            {
                                guard: "shouldPromotePossibleCircle",
                                target: "circleLikely"  
                            },
                            {
                                target: null
                            }
                        ]
                        
                    },
                    END: {
                        effects: ["todo: emit event with reason 'no stable centroid'"],
                        target: "idle"
                    }
                }
            },

            /**
             * "circleLikely": enough points have been collected to compare added
             * points to the radius established throughout the gesture.
             */
            circleLikely: {
                on: {
                    POINT_ADDED: {
                        update: "addPoint",
                        transitions: [
                            {
                                guard: "shouldRejectCircleLikely",
                                effects: [
                                    "getRejectionReason",
                                    "todo: report circle rejected"
                                ],
                                target: "idle"
                            },
                            {
                                guard: "todo: call shouldReportCircleEarly()",
                                effects: ["todo: report circle detected"],
                                target: "idle",  
                            },
                            {
                                target: null
                            }
                        ]
                        
                    },
                    END: {
                        transitions: [
                            {
                                guard: "todo: meetsAllCircularityChecks",
                                effects: ["todo: circle detected output"],
                                target: "idle"
                            },
                            {
                                effects: ["todo: report circle rejected and reason"],
                                target: "idle"
                            }
                        ]
                    }
                }
            }
        }
    }


    /**
     * OLD State Machine draft
     * To be refactored into smDefinition
     */
    states = {
        idle: {
            /**
             * Start sampling
             * @param {CircleGestureRecognizer} ctx - Context
             * @param {PointSample} point - Starting point.
             */
            start(ctx, point) {
                const options = {
                    minSamples: ctx.thresholds.minSamples,
                    minDistance: ctx.thresholds.minDistance
                }
                ctx.log = new SampleLog(
                    point, 
                    ctx.thresholds.dejitterDistance,
                    options
                );
                ctx.state = ctx.states.tooEarly;
            }
        },


        /**
         * "possibleCircle": there are not yet enough points to calculate a
         * stable centroid.
         */
        possibleCircle: {
            /**
             * Gesture ended.
             * @param {CircleGestureRecognizer} ctx - Context. 
             * @param {string} msg - Message why gesture ended.
             */
            end(ctx, msg) {
                ctx.#toNotCircle(msg);
            }
        },

        /**
         * "circleLikely": enough points have been collected to compare added
         * points to the radius established throughout the gesture.
         */
        circleLikely: {
            /**
             * Add a point to the current gesture.
             * @param {CircleGestureRecognizer} ctx - Context.
             * @param {number} x - x-coordinate.
             * @param {number} y - y-coordinate.
             * @param {number} t - timestamp.
             * @todo Check for transition to circleComplete
             * @todo Radius stability checks
             */
            addPoint(ctx, x, y, t) {
                ctx.log.add(x, y, t);

                //check if definitely not a circle
                if (ctx.isTooBig()) {
                    this.end(ctx, "Gesture is too big.");
                }
                if (ctx.hasTooManyBacktracks(ctx)) {
                    this.end(ctx, "Gesture has too many reversals.");
                }
                //@todo add radius stability checks

                //@todo check for transition to next state
                if (false) {
                    ctx.state = ctx.states.circleComplete;
                }
            },
            /**
             * Gesture ended: Checks to see if the complete path is a circle.
             * @param {CircleGestureRecognizer} ctx - Context. 
             * @param {string} msg - Message why gesture ended.
             */
            end(ctx, msg) {
                if (ctx.meetsAllCircularityChecks()) {
                    ctx.state = ctx.states.circleComplete;
                } else {
                    ctx.#toNotCircle("Does not meet final circularity checks.");
                }
            }


        },

        /**
         * "circleComplete": recognized as a circle.
         * Further input ignored. 
         */
        circleComplete: {
            /**
             * Ignore extra points.
             */
            addPoint(ctx, x, y, t) {
                //no-op
            },

            /**
             * Ending when already complete is no-op.
             */
            end(ctx, msg) {
                //no-op
            }

        },

        /**
         * "notCircle": rejected as a circle.
         * Further input ignored.
         */
        notCircle: {
            addPoint(ctx, x, y, t) {
                //no-op - already rejected
            },

            end(ctx, msg) {
                //no-op - already rejected
            }
        }
    }

    /***************************************************************************
     * DRAFT Public API
     * start, addPoint, & end delegate to the state machine versions as appropriate
     **************************************************************************/
     
    /**
     * Start a new gesture with the first point.
     * @param {PointSample} point 
     */
    start(point) {
        this.state.start?.(this, point);
    }

    

    /**
     * Signal that the gesture has ended.
     * @param {string} [msg] - Message about why gesture ended.
     */
    end(msg = "") {
        this.state.end?.(this, msg);
    }
    
    isCircle() {
        return this.state === this.states.circleComplete;
    }

    isNotCircle() {
        return this.state === this.states.notCircle;
    }

    /***************************************************************************
     * Internal methods & helpers
     **************************************************************************/


    /**
     * Starts gesture sampling with a new SampleLog (this.log).
     * @param {number} x - x-coordinate for first point.
     * @param {number} y - y-coordinate for first point.
     * @param {number} t - timestamp.
     */
    #initializeSampleLog(x, y, t) {
        const options = {
            minSamples: this.thresholds.minSamples,
            minDistance: this.thresholds.minDistance
        }
        const initialPoint = new PointSample(x, y, t);

        this.log = new SampleLog(
            initialPoint, 
            this.thresholds.dejitterDistance,
            options
        );
    }


    /**
     * Check if all conditions are met for transitioning from "tooEarly" 
     * to "possibleCircle" state.
     * @returns {boolean}
     */
    #shouldLeaveTooEarly() {
        return this.log.isReadyForClassification();
    }

    /**
     * Check if conditions are met for rejecting the gesture as circular 
     * from the "possibleCircle" state.
     * @returns {boolean}
     */
    #shouldRejectPossibleCircle() {
        return this.#isTooBig() || this.#hasTooManyBacktracks();
    }

    /**
     * Check if all conditions are met for transitioning from "possibleCircle"
     * to "circleLikely"
     * @returns {boolean}
     */
    #shouldPromotePossibleCircle() {
        return this.#canComputeCentroid();
    }

    /**
     * Check if all conditions are met for rejecting the gesture as circular 
     * from the "circleLikely" state.
     * @returns {boolean}
     * @todo
     */
    #shouldRejectCircleLikely() {
        criteria = [];
        criteria.push(this.#isTooBig());
        criteria.push(this.#hasTooManyBacktracks());

        //todo: radius stability and other checks?

        return criteria.some(Boolean);
    }

    /**
     * Check if all conditions are met to detect a circle.
     * @returns {boolean}
     * @todo
     */
    shouldReportCircleEarly() {
        return false;
    }

    /**
     * Add a point to the current gesture.
     * @param {number} x - x-coordinate.
     * @param {number} y - y-coordinate. 
     * @param {number} t - timestamp.
     */
    #addPoint(x, y, t) {
        this.state.addPoint?.(this, x, y, t);
    }


    
    
    
    /**
     * Determines why the gesture was rejected (as not circular).
     * @param {string} state - the state machine's state
     * @param {"ADD"|"END"} phase - the phase of gesture handling
     * @returns {RejectionReason} 
     * @throws {Error} If no state or rejection reason is available.
     */
    #getRejectionReasonFor(state, phase) {
        const rules = CircleGestureRecognizer.#REJECTION_RULES[state]?.[phase];

        if (!rules) {
            throw new Error(`No rejection rules for ${state}.${phase}`);
        }

        for (const rule of rules) {
            if (rule.test(this)) {
                return rule.reason;
            }
        }

        throw new Error(`Expected a rejection reason for ${state}.${phase}`);
    }


    /**
     * Checks if gesture has accumulated enough angle/turn for the 
     * circle centroid to be considered stable when calculated.
     * Note this check is expected to be used for the transition out of
     * possible circle.
     * @param {CircleGestureRecognizer} ctx - Context.
     * @returns {boolean} 
     */
    #canComputeCentroid() {
        return this.log.getTotalTurnDegrees() > this.thresholds.centroidCalcAngleAccum;
    }

    /**
     * Checks if the gesture has exceeded the maximum allowed diameter.
     * @returns {boolean}
     */
    #isTooBig() {
        const dx = this.log.getBoundingWidth();
        const dy = this.log.getBoundingHeight();
        const max = this.thresholds.maxDiameter
        return dx > max || dy > max;
    }

    /**
     * Checks to see if the gesture has had too many reversals/backtracks.
     * @param {CircleGestureRecognizer} ctx 
     */
    #hasTooManyBacktracks() {
        const backtrackCount = this.log.directionChangeCount;
        return backtrackCount > this.thresholds.maxReversals;
    }

    /**
     * TODO: Checks to see if the gesture is too far out of round.
     * @returns {boolean}
     * @todo build logic
     */
    #radiusDeviationTooHigh() {
        return false;
    }

    /**
     * TODO: Checks to see if the gesture has completed enough angular sweep
     * to potentially be considered a circle.
     * @returns {boolean}
     * @todo build logic
     */
    #hasCompleteAngularSweep() {
        return false;
    }


    /**
     * Change state to notCircle.
     * Can happen from any state except idle.
     * @param {string} [msg] - Message about why circle rejected.
     */
    #toNotCircle(msg = "") {
        this.eventDetail = {
            msg: msg
        }

        this.state = this.states.notCircle;
    }

    /**
     * Checks all circularity measures.
     * Note intended to be used when a gesture is completed.
     * @param {CircleGestureRecognizer} ctx - Context.
     * @returns {boolean}
     * @todo Not yet implemented
     */
    meetsAllCircularityChecks(ctx) {
        console.warn("meetsAllCircularityChecks() not implemented.");
        return false;
    }

    /**
     * Computes arithmetic mean of the sample points. 
     * This becomes closer to the actual centroid with a larger angular sweep.
     * @private
     * @param {PointSample[]} [sample] - Optional array of point samples. 
     * Defaults to full gesture log (this.log.log).
     * @returns {{x: number, y: number}} - mean xy-coordinate of sample.
     */
    #computeCentroid(sample) {
        if (!sample) {
            sample = this.log.log;
        }

        let sumX = 0;
        let sumY = 0;

        for (const pt of sample) {
            sumX += pt.x;
            sumY += pt.y;
        }

        return {
            x: sumX / sample.length,
            y: sumY / sample.length
        };
    }
    
    /**
     * Calculates normalized radius deviation of points from their mean centroid.
     * Lower values indicate that the points lie at a consistent distance 
     * from the center.
     * @param {PointSample[]} sample - array of point samples, defaults
     * to full gesture log (this.log.log).
     * @returns {number} - normalized standard deviation of the sample 
     * (stddev/mean radius)
     */
    computeRadiusDeviation(sample) {
        if (!sample) {
            sample = this.log.log;
        }

        const c = this.#computeCentroid(sample);

        const radii = sample.map(pt => Math.hypot(pt.x - c.x, pt.y - c.y));

        const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
        if (mean === 0) return Infinity;

        const variance = radii.reduce((acc, r) => acc + (r - mean) ** 2, 0) / radii.length;
        const stddev = Math.sqrt(variance);
        const deviation = stddev / mean;
        return deviation;

    }

    /**
     * @todo
     * @returns {boolean}
     */
    #looksRoughlyCircular() {
        return true;
    }

    /**
     * @todo
     * @returns {boolean}
     */
    #stillLooksCircular() {
        return true;
    }

    /**
     * @todo
     * @returns {boolean}
     */
    #circularEvidenceStrong() {
        return true;
    }
}