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
        this.state = this.states.idle;

        /**
         * Details for an event to be dispatched.
         * Will be populated when gesture is definitely detected.
         * @type {object} - details to publish along with the event.
         */
        this.eventDetail = {};
    }

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
     * Add a point to the current gesture.
     * @param {number} x - x-coordinate.
     * @param {number} y - y-coordinate. 
     * @param {number} t - timestamp.
     */
    addPoint(x, y, t) {
        this.state.addPoint?.(this, x, y, t);
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
     * Checks if gesture is within the minimum allowed diameter.
     * Note this check is expected to be used for the transition out of tooEarly.
     * @param {CircleGestureRecognizer} ctx - Context.
     */
    isWithinStartingCircle(ctx) {
        return ctx.log.isReadyForClassification();
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
     * @param {CircleGestureRecognizer} ctx 
     * @returns {boolean}
     */
    isTooBig(ctx) {
        const dx = ctx.log.getBoundingWidth();
        const dy = ctx.log.getBoundingHeight();
        const max = ctx.thresholds.maxDiameter
        return dx > max || dy > max;
    }

    /**
     * 
     * @param {CircleGestureRecognizer} ctx 
     */
    hasTooManyBacktracks(ctx) {
        const backtrackCount = ctx.log.directionChangeCount;
        return backtrackCount > ctx.thresholds.maxReversals;
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