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

    //thresholds and parameters
    #dejitterDistance;
    #minDiameter;
    #maxDiameter;

    /**
     * 
     * @param {object} param0 
     */
    constructor({
        dejitterDistance,
        minDiameter,
        maxDiameter
    } = {}) {
        this.#dejitterDistance = dejitterDistance;
        this.#minDiameter = minDiameter;
        this.#maxDiameter = maxDiameter;

        this.log = null
        this.state = this.states.idle;
    }

    states = {
        idle: {

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


}