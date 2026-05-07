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

/**
 * @typedef {Object} CircleStats
 * @property {number} duration - Gesture duration in the same time unit as samples.
 * @property {number} radius - Mean radius of the gesture.
 * @property {{x: number, y: number}|null} center - Estimated center, or null if not available.
 * @property {number} height - Bounding box height.
 * @property {number} width - Bounding box width.
 * @property {number|null} circularity - Normalized radius deviation, or null if not available.
 * @property {number} sweep - Total accumulated turn in degrees.
 */

/**
 * @typedef {"acceptCircle"|"rejectCircle"|null} CircleDecision
 */

/**
 * Report object describing the outcome or progress of a circle gesture.
 * @typedef {Object} CircleReport
 * @property {CircleDecision} decision - Current decision, or null if pending.
 * @property {string|null} state - State machine state when report created, or null after acceptance.
 * @property {CircleStats} circleStats - Aggregated statistics about the gesture.
 * @property {SampleLog|null} log - Underlying gesture log, if available.
 */

/**
 * Report object describing a rejected circle gesture.
 * Extends CircleReport with a rejection reason.
 * @typedef {Object} CircleRejectedReport
 * @property {"rejectCircle"} decision
 * @property {string} state
 * @property {RejectionReason} reason
 * @property {CircleStats} circleStats
 * @property {SampleLog|null} log
 */


export default class CircleGestureRecognizer {
    static POSSIBLE_STATES = [
        "idle",
        "tooEarly",
        "possibleCircle", 
        "circleLikely"
    ];

    /**
     * Lookup table of rejection reasons.
     * @type {Object<string, RejectionReason>}
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
        this.state = this.smDefinition.initial ?? "idle";
    }

    /**
     * Send information to the State Machine to take action and change state
     * as appropriate.
     * 
     * ## Runner convention
     *  1. Look up the current state's configuration.
     *  2. Apply any event level `update`.
     *  3. Evaluate guards: Choose the first matching transition.
     *  4. Change state if the chosen transition has non-null target.
     *  5. Build and return any requested report.
     * 
     * @param {"START"|"POINT_ADDED"|"END"} type - the type of call 
     * @param {{ point?: PointSample }} payload - event payload.
     * @returns {CircleReport|CircleRejectedReport|null}
     *   Report describing the outcome of this event, or null @@
     * @todo Build logic
     */
    send(type, payload={}) {
        // 1. current state's configuration
        const stateDef = this.smDefinition.states[this.state];
        const eventDef = stateDef?.on?.[type];
        if (!eventDef) return null;

        // make metadata used by some guards/reporters
        const meta = {
            state = this.state,
            phase: this.#getPhaseForEvent(type), //get ADD/END
            type,
            payload
        };

        //2. apply event-level update if appropriate
        if (eventDef.update) {
            const updateFunc = this.updateHandlers[eventDef.update];

            if (!updateFunc) {
                throw new Error(`Unknown update handler: ${eventDef.update}`);
            }
            updateFunc(payload);
        }

        //3. select the first matching transition by guard
        //4. apply state change
        //5. return report about state, changed, effects

        return null;

    }

    /***************************************************************************
     * Mapping Registries
     **************************************************************************/
    guardHandlers = {
        shouldLeaveTooEarly: () => this.#shouldLeaveTooEarly(),
        shouldRejectCircle: (meta) => this.#shouldRejectCircle(meta.state, meta.phase),
        shouldPromotePossibleCircle: () => this.#shouldPromotePossibleCircle(),
        meetsAllCircularityChecks: () => this.#meetsAllCircularityChecks()
    };

    updateHandlers = {
        addPoint: (payload) => this.#addPoint(payload.point),
        initializeSampleLog: (payload) => this.#initializeSampleLog(payload.point)
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
     *  - reports are to be collected by the runner and returned to caller
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
                        update: "initializeSampleLog",
                        target: "tooEarly",
                        report: "pending"
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
                                report: "pending"
                            },
                            {
                                target: null
                            }
                        ]
                        
                    },
                    END: {
                        target: "idle",
                        report: "reject"
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
                                target: "idle",
                                report: "reject"
                            },
                            {
                                guard: "shouldPromotePossibleCircle",
                                target: "circleLikely",
                                report: "pending"
                            },
                            {
                                target: null
                            }
                        ]
                        
                    },
                    END: {
                        target: "idle",
                        report: "reject"
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
                                target: "idle",
                                report: "reject"
                            },
                            {
                                guard: "meetsAllCircularityChecks",
                                target: "idle",
                                report: "accept"
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
                                target: "idle",
                                report: "accept"
                            },
                            {
                                target: "idle",
                                report: "reject"
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
        this.send("START", { point });
    }

    /**
     * Add a point to the current gesture.
     * @param {PointSample} point
     */
    addPoint(point) {
        this.send("POINT_ADDED", { point });
    }

    /**
     * Signal that the gesture has ended.
     */
    end() {
        this.send("END", {});
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
     */
    #hasTooManyBacktracks() {
        const backtrackCount = this.log.directionChangeCount;
        return backtrackCount > this.thresholds.maxReversals;
    }

    /**
     * TODO: Checks to see if the gesture is too far out of round.
     * @returns {boolean}
     * @todo build logic
     * @todo consider if there should be more tolerance early on and tighter
     * tolerances for the final check (when we have the best centroid)
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
        return this.log.getTotalTurnDegrees() >= this.thresholds.completeAngleAccum;
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
     * @param {PointSample[]} [sample] - array of point samples, defaults
     * to full gesture log (this.log.log).
     * @returns {number} - normalized standard deviation of the sample 
     * (stddev/mean radius)
     */
    computeRadiusDeviation(sample) {
        if (!sample) {
            sample = this.log.log;
        }

        const c = this.#computeCentroid(sample);

        const radii = this.#computeRadii(c, sample);

        const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
        if (mean === 0) return Infinity;

        const variance = radii.reduce((acc, r) => acc + (r - mean) ** 2, 0) / radii.length;
        const stddev = Math.sqrt(variance);
        const deviation = stddev / mean;
        return deviation;

    }

    /**
     * Computes distance of each point from a centroid.
     * @param {{x: number, y: number}} centroid - xy-coordinate of centroid.
     * @param {PointSample[]} points - array of PointSamples, defaults to 
     * full gesture log (this.log.log) 
     * @returns {number[]} distances between centroid & each point in points.
     */
    #computeRadii(centroid, points) {
        if (!points) {
            points = this.log.log;
        }

        return points.map(pt => Math.hypot(pt.x - centroid.x, pt.y - centroid.y));
    }

    /**
     * Maps event type to the rejection rule phase
     * @param {"POINT_ADDED"|"END"|"START"} type 
     * @returns {"ADD"|"END"|null}
     */
    #getPhaseForEvent(type) {
        if (type === "POINT_ADDED") {
            return "ADD";
        }
        if (type === "END") {
            return "END";
        }
        return null;
    }



    /**
     * Returns the proper report.
     * @param {"pending"|"accept"|"reject"|undefined} reportKind
     * @param {{ state: string, phase: "ADD"|"END"}} meta
     * @returns {CircleReport|CircleRejectedReport|null}
     * @private
     */
    #buildReport(reportKind, meta) {
        if (reportKind === "accept") {
            return this.#getCircleAcceptedReport();
        }
        if (reportKind === "reject") {
            if (!meta.phase) {
                throw new Error("Reject report requires a valid phase.");
            }
            return this.#getCircleRejectedReport(meta.state, meta.phase);
        }
        if (reportKind === "pending") {
            return this.#getPendingCircleReport();
        }
        return null;
    }

    /**
     * Returns a report for a continuing gesture (neither accepted nor rejected).
     * @returns {CircleReport}
     */
    #getPendingCircleReport() {
        return {
            decision: null,
            state: this.state,
            circleStats: this.#getCircleStats(),
            log: this.log
        }
    }

    /**
     * Returns a report for circle gesture acceptance.
     * @returns {CircleReport}
     */
    #getCircleAcceptedReport() {
        return {
            decision: "acceptCircle",
            state: null,
            circleStats: this.#getCircleStats(),
            log: this.log
        }
    }

    /**
     * Returns object for reporting circle gesture rejection.
     * @param {"idle"|"tooEarly"|"possibleCircle"|"circleLikely"} state 
     * @param {"ADD"|"END"} phase 
     * @returns {CircleRejectedReport}
     */
    #getCircleRejectedReport(state, phase) {
        return {
            decision: "rejectCircle",
            state,
            circleStats: this.#getCircleStats(),
            reason: this.#getRejectionReasonFor(state, phase),
            log: this.log
        }
    }

    /**
     * Returns object for reporting circle statistics.
     * @returns {CircleStats}
     */
    #getCircleStats() {
        const canCalculate = this.#canComputeCentroid();
        const radii = this.#computeRadii();
        const avgRadius = radii.reduce((sum, num) => sum + num, 0) / radii.length;

        return {
            duration: this.log.fromLast().t - this.log.start.t,
            radius: avgRadius,
            center: canCalculate ? this.#computeCentroid() : null, // {x, y}|null
            height: this.log.getBoundingHeight(),
            width: this.log.getBoundingWidth(),
            circularity: canCalculate ? this.computeRadiusDeviation() : null,
            sweep: this.log.getTotalTurnDegrees()
        }
    }

}
