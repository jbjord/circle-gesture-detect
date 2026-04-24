import PointSample from "../model/point-sample";
import SampleLog from "../model/sample-log.js";


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
        shouldLeaveTooEarly: (event) => this.#shouldLeaveTooEarly(event),
        shouldRejectPossibleCircle: (event) => this.#shouldRejectPossibleCircle(event),
    };

    updateHandlers = {
        addPoint: (x, y, t) => this.#addPoint(x, y, t)
    };

    effectHandlers = {
        getPossibleCircleRejectReason: () => this.#getPossibleCircleRejectReason(),
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
                        effects: ["todo: initialize sampleLog"],
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
                        update: "todo: add point",
                        transitions: [
                            {
                                guard: "shouldRejectPossibleCircle",
                                effects: [
                                    "getPossibleCircleRejectReason",
                                    "todo: report circle rejected"
                                ],
                                target: "idle"
                            },
                            {
                                guard: "todo: call shouldPromotePossibleCircle()",
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
                        update: "todo: add point",
                        transitions: [
                            {
                                guard: "todo: call shouldRejectCircleLikely()",
                                effects: [
                                    "todo: set rejection reason",
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
         * "tooEarly": gesture logging has started but there are not yet enough 
         * points to make any decisions.
         */
        tooEarly: {
            /**
             * Add a point to the current gesture.
             * @param {CircleGestureRecognizer} ctx - Context.
             * @param {number} x - x-coordinate.
             * @param {number} y - y-coordinate.
             * @param {number} t - timestamp.
             */
            addPoint(ctx, x, y, t) {
                ctx.log.add(x, y, t);
                if (!ctx.isWithinStartingCircle(ctx)) {
                    ctx.state = ctx.states.possibleCircle;
                }
            },
            /**
             * Gesture ended.
             * @param {CircleGestureRecognizer} ctx - Context.
             * @param {string} msg - Message why gesture ended. 
             */
            end(ctx, msg) {
                ctx.#toNotCircle();
            }

        },

        /**
         * "possibleCircle": there are not yet enough points to calculate a
         * stable centroid.
         */
        possibleCircle: {
            /**
             * Add a point to the current gesture.
             * @param {CircleGestureRecognizer} ctx - Context.
             * @param {number} x - x-coordinate.
             * @param {number} y - y-coordinate.
             * @param {number} t - timestamp.
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

                //check for transition to next state
                if (ctx.canComputeCentroid(ctx)) {
                    ctx.state = ctx.states.circleLikely;
                }
            },
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
     * Check if all conditions are met for transitioning from "tooEarly" 
     * to "possibleCircle" state.
     * @returns {boolean}
     * @todo
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
     * @todo
     */
    shouldPromotePossibleCircle() {
        return false;
    }

    /**
     * Check if all conditions are met for rejecting the gesture as a circular 
     * from the "circleLikely" state.
     * @returns {boolean}
     * @todo
     */
    shouldRejectCircleLikely() {
        return false;
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

    /***************************************************************************
     * Reason checkers
     **************************************************************************/
    /**
     * @typedef {Object} RejectionReason
     * @property {string} code - Stable machine-readable reason code.
     * @property {string} message - Human-readable rejection message.
     */

    /**
     * Determines why the gesture should be rejected.
     * @returns {RejectionReason} 
     * @throws {Error} If no rejection reason is available.
     */
    #getPossibleCircleRejectReason() {
        if(this.#isTooBig()) {
            return { 
                code: "tooBig", 
                message: "Gesture is too big"
            };
        }
        if(this.#hasTooManyBacktracks()) {
            return { 
                code: "tooManyReversals", 
                message: "Gesture has too many reversals"
            }
        }

        throw new Error(
            "Expected a possibleCircle rejection reason, but none was found."
        );
    }


    /**
     * Checks if gesture has accumulated enough angle/turn for the 
     * circle centroid to be considered stable when calculated.
     * Note this check is expected to be used for the transition out of
     * possible circle.
     * @param {CircleGestureRecognizer} ctx - Context.
     * @returns {boolean} 
     */
    canComputeCentroid(ctx) {
        return ctx.log.getTotalTurnDegrees() > ctx.thresholds.centroidCalcAngleAccum
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