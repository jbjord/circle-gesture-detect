import PointSample from "../model/point-sample";
import SampleLog from "../model/sample-log.js";
import CircleGestureThresholds from "../config/default-thresholds.js"

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
        /**@type {CircleGestureThresholds} */
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
        shouldRejectCircle: (state, phase) => this.#shouldRejectCircle(state, phase),
        shouldPromotePossibleCircle: () => this.#shouldPromotePossibleCircle(),
        meetsAllCircularityChecks: () => this.#meetsAllCircularityChecks()
    };

    updateHandlers = {
        addPoint: (sample) => this.#addPoint(sample)
    };

    effectHandlers = {
        initializeSampleLog: (sample) => this.#initializeSampleLog(sample),
        getRejectionReason: (state, phase) => this.#getRejectionReasonFor(state, phase),
//        reportReject: (event) => this.#reportReject(event),
//        reportCircleDetected: (event) => this.#reportCircleDetected(event)
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
                                guard: "shouldRejectCircle",
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
                                guard: "shouldRejectCircle",
                                effects: [
                                    "getRejectionReason",
                                    "todo: report circle rejected"
                                ],
                                target: "idle"
                            },
                            {
                                guard: "meetsAllCircularityChecks",
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
                                guard: "meetsAllCircularityChecks",
                                effects: ["todo: circle detected output"],
                                target: "idle"
                            },
                            {
                                effects: [
                                    "getRejectionReason",
                                    "todo: report circle rejected and reason"
                                ],
                                target: "idle"
                            }
                        ]
                    }
                }
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
     * @param {PointSample} initialPoint
     */
    #initializeSampleLog(initialPoint) {
        const options = {
            minSamples: this.thresholds.minSamples,
            minDistance: this.thresholds.minDistance
        }

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
     * Check if all conditions are met for transitioning from "possibleCircle"
     * to "circleLikely"
     * @returns {boolean}
     */
    #shouldPromotePossibleCircle() {
        return this.#canComputeCentroid();
    }

    /**
     * Add a point to the current gesture.
     * @param {PointSample} sample
     */
    #addPoint(sample) {
        this.log.add?.(sample);
    }

    /**
     * Checks if any applicable condition is met that would cause a circle to 
     * be rejected.
     * @param {string} state - the state machine's state
     * @param {"ADD"|"END"} phase phase - the phase of gesture handling
     * @returns {boolean}
     */
    #shouldRejectCircle(state, phase) {
        const rules = CircleGestureRecognizer.#REJECTION_RULES[state]?.[phase];
        if (!rules) {
            return false;
        }

        return rules.some(rule => rule.test(this));
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
     * Checks if the gesture is too small to be considered a valid circle.
     * Intended to be used when a gesture is finalized.
     * @returns {boolean}
     */
    #isTooSmall() {
        const dx = this.log.getBoundingWidth();
        const dy = this.log.getBoundingHeight();
        const min = this.thresholds.minDiameter
        return dx <= min || dy <= min;
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
     * Checks to see if the gesture has completed enough angular sweep
     * to potentially be considered a circle.
     * @returns {boolean}
     */
    #hasCompleteAngularSweep() {
        return this.log.totalTurn >= this.thresholds.completeAngleAccum;
    }

    /**
     * Checks to see if the most recent/end point of the gesture is close
     * enough to the starting point.
     * @returns {boolean}
     */
    #meetsClosureDistance() {
        const limit = this.thresholds.closureDistance;
        return limit == null || this.log.distanceFromStart() <= limit;
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
     * Checks all circularity measures to see if a circle gesture can be
     * accepted right now (either during a gesture or at gesture end).
     * @returns {boolean}
     */
    #meetsAllCircularityChecks() {
        return (
            !this.#isTooBig() &&
            !this.#isTooSmall() &&
            !this.#hasTooManyBacktracks() &&
            !this.#radiusDeviationTooHigh() &&
            this.#hasCompleteAngularSweep() &&
            this.#meetsClosureDistance()
        );
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