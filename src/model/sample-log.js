/**
 * Log of sampled points for a gesture.
 * @class
 */
export default class SampleLog {
    #minX;
    #maxX;
    #minY;
    #maxY;

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

        //set initial min/max bounding coords
        this.#minX = start.x;
        this.#maxX = start.x;
        this.#minY = start.y;
        this.#maxY = start.y;
    }


    /**
     * Add a PointSample to the log with de-jittering based on this.minStep.
     * Subsequent points have to be at least this.minStep distance away.
     * @overload
     * @param {PointSample} point - The point to add.
     * @returns {boolean} Whether point was added to log or not.
     */

    /**
     * Add a point (xy-coord + timestamp) to the log with de-jittering based 
     * on this.minStep.
     * Subsequent points have to be at least this.minStep distance away.
     * @overload
     * @param {number} x - x-coordinate.
     * @param {number} y - y-coordinate.
     * @param {number} t - timestamp.
     * @returns {boolean} Whether point was added to log or not.
     */

    /**
     * Implementation of the overloaded add() method.
     * @param {PointSample|number} a
     * @param {number} [b]
     * @param {number} [c]
     * @returns {boolean}
     */
    add(a, b, c) {
        let point;
        // add(PointSample)
        if (a instanceof PointSample) {
            point = a;
        }
        // add(x, y, t)
        else {
            point = new PointSample(a, b, c);
        }

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
        this.#updateMinMaxCoords();
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

    /**
     * Update minimum & maximum bounding coordinates.
     * @param {PointSample} point
     */
    #updateMinMaxCoords(point) {
        if (point.x < this.#minX) {
            this.#minX = point.x;
        } else if (point.x > this.#maxX) {
            this.#maxX = point.x;
        }

        if (point.y < this.#minY) {
            this.#minY = point.xy;
        } else if (point.y > this.#maxY) {
            this.#maxY = point.y;
        }
    }

    /**
     * Gets the width that the logged points have covered.
     * @returns {number}
     */
    getBoundingWidth() {
        return this.#maxX - this.#minX;
    }

    /**
     * Gets the height that the logged points have covered.
     * @returns {number}
     */
    getBoundingHeight() {
        return this.#maxY - this.#minY;
    }

}
