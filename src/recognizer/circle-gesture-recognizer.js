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
     * 
     * @param {object} param0 
     */
    constructor({
        dejitterDistance,
        minDiameter,
        maxDiameter
    } = {}) {
        this.dejitterDistance = dejitterDistance;
        this.minDiameter = minDiameter;
        this.maxDiameter = maxDiameter;

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
                ctx.log = new SampleLog(point, ctx.dejitterDistance);
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

 

    /**
     * Checks if gesture is within the minimum allowed diameter.
     * Note this check is expected to be used for the transition out of tooEarly.
     * @param {CircleGestureRecognizer} ctx - Context.
     */
    isWithinStartingCircle(ctx) {
        return Math.abs(ctx.log.distanceFromStart()) <= ctx.minDiameter;
    }

    /**
     * Checks if the gesture has exceeded the maximum allowed diameter.
     * @param {CircleGestureRecognizer} ctx 
     * @returns {boolean}
     */
    isTooBig(ctx) {
        const dx = ctx.log.getBoundingWidth();
        const dy = ctx.log.getBoundingHeight();
        return dx > ctx.maxDiameter || dy > ctx.maxDiameter;
    }

    /**
     * Change state to notCircle.
     * Can happen from any state except idle & tooEarly.
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