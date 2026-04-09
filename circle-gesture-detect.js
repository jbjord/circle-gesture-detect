CGD_THRESHOLDS = {
    radius: {
        min: 15,
        max: 1080
    },
    angleAccumulation: {
        min: 270,
        max: 450
    }
}

/**
 * A sampled xy-point with a timestamp
 * @class
 */
class PointSample {
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

/**
 * Log of sampled points for a gesture.
 * @class
 */
class SampleLog {
    /**
     * Stores sampled points of the gesture.
     *  - .log are the logged points after de-jittering
     *  - .rawLog are all points
     * @param {PointSample} start - starting point for this sample
     * @param {number} minStep - minimum distance between subsequent logged points
     */
    constructor(start, minStep) {
        /**
         * Starting point
         * @type {PointSample}
         */
        this.start = start;
        this.minStep = minStep;
        this.pathLength = 0;
        this.rawLog = [start]; //all points logged
        this.log = [start]; //de-jittered points
    }

    /**
     * Add a point to the log with de-jittering based on this.minStep.
     * Subsequent points have to be at least this.minStep distance away.
     * @param {PointSample} point - The point to add.
     * @returns {boolean} Whether point was added to log or not.
     */
    add(point) {
        this.rawLog.add(point);

        prev = this.log[this.log.length - 1];
        const dx = point.x - prev.x;
        const dy = point.y - prev.y;
        const step = Math.hypot(dx, dy);

        //dejitter: next logged point has to be > minSteps away from prev
        if (step < this.minStep) {
            return false;
        }
        
        pathLength += step;

        this.log.push(point);
        return true;    
    }

    /**
     * Return the point from the log in the negative index position.
     * Examples: fromLast() gives last element
     *           fromLast(2) gives second to last element
     *           fromLast(3) gives third to last element
     * @param {number} [n = 1] negative index from array end 
     * @returns {PointSample}
     */
    fromLast(n = 1) {
        const index = this.log.length - n;
        return index >= 0 ? this.log[index] : undefined;
    }


    /**
     * Returns the distance between starting and last logged points.
     * @returns {number} Euclidean distance between start & last
     */
    distanceFromStart() {
        return this.start.distance(this.log[this.log.length - 1]);
    }


}
