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
    }

    states = {
        idle: {
            /**
             * Start sampling
             * @param {CircleGestureRecognizer} ctx - Context
             * @param {PointSample} point - Starting point.
             */
            start(ctx, point) {
                ctx.log = new SampleLog(point, ctx.thresholds.dejitterDistance);
                ctx.state = ctx.states.tooEarly;
            }
        },

        tooEarly: {

        },

        possibleCircle: {

        },

        circleLikely: {

        },

        circleComplete: {

        },

        notCircle: {

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
     */
    end() {
        this.state.end?.(this);
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
        return Math.abs(ctx.log.distanceFromStart()) <= ctx.thresholds.minDiameter;
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
     */
    #toNotCircle() {
        this.state = this.states.notCircle;
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