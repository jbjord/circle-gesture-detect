/**
 * A sampled xy-point with a timestamp
 * @class
 */
export default class PointSample {
    /**
     * @constructor
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} t - Timestamp (ms or arbitrary units)
     */
    constructor(x, y, t) {
        /** @type {number} */
        this.x = x;

        /** @type {number} */
        this.y = y;

        /** @type {number} */
        this.t = t;
    }

    /**
     * Return Euclidean distance between this point and another.
     * @param {PointSample} other - The other point for comparison.
     * @returns {number} Euclidean distance.
     */
    distance(other) {
        return Math.hypot(other.x - this.x, other.y - this.y)
    }

}
