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

        //directional metrics
        this.clockwiseLength = 0;
        this.counterClockwiseLength = 0;
        this.mostRecentDirection = "straight";
        this.directionChangeCount = 0;

        //logs of PointSamples
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
        this.#updateDirectionalMetrics();
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
     * 
     * @param {PointSample} a - 2nd from last point.
     * @param {PointSample} b - Penultimate point.
     * @param {PointSample} c - Latest point.
     */
    #vectorProducts(a, b, c) {
        const deltaAB = this.#getDeltas(a, b);
        const deltaBC = this.#getDeltas(b, c);

        const dotProduct = deltaAB.x * deltaBC.x + deltaAB.y * deltaBC.y;
        const crossProduct = deltaAB.x * deltaBC.y - deltaAB.y * deltaBC.x;

        return { dot: dotProduct, cross: crossProduct}
    }

    /**
     * Calculates differences in coordinates and optionally time.
     * @param {PointSample} a - start point.
     * @param {PointSample} b - end point.
     * @param {boolean} calculateDeltaT - whether deltaT should be calculated or not.
     * @returns {PointSample} - With difference in x, in y, and optionally in t
     * (or null if calculateDeltaT=false).
     */
    #getDeltas(a, b, calculateDeltaT=false) {
        const deltaX = b.x -a.x;
        const deltaY = b.y - a.y;
        let deltaT = null;
        if (calculateDeltaT) {
            deltaT = b.t - a.t; 
        }
        return new PointSample(deltaX, deltaY, deltaT);
    }

    /**
     * Return counter/clockwise direction of latest three points.
     *
     * Overloads:
     *
     * @overload
     * @method #getClockwiseDirection
     * @returns {"straight"|"counterclockwise"|"clockwise"}
     *
     * @overload
     * @method #getClockwiseDirection
     * @param {{ epsilon?: number }} options
     * @returns {"straight"|"counterclockwise"|"clockwise"}
     *
     * @overload
     * @method #getClockwiseDirection
     * @param {PointSample} a
     * @param {PointSample} b
     * @param {PointSample} c
     * @returns {"straight"|"counterclockwise"|"clockwise"}
     *
     * @overload
     * @method #getClockwiseDirection
     * @param {PointSample} a
     * @param {PointSample} b
     * @param {PointSample} c
     * @param {{ epsilon?: number }} options
     * @returns {"straight"|"counterclockwise"|"clockwise"}
     *
     * @param {...any} args Internal implementation (do not call directly with args array).
     * @private
     */
    #getClockwiseDirection(...args) {
        let a, b, c;
        let epsilon = 0.001;

        const isOptionsObject = (value) =>
            value != null &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            ("epsilon" in value);

        if (args.length === 0) {
            if (this.log.length < 3) return "straight";
            [a, b, c] = this.log.slice(-3);
        } else if (args.length === 1 && isOptionsObject(args[0])) {
            ({ epsilon = 0.001 } = args[0]);
            if (this.log.length < 3) return "straight";
            [a, b, c] = this.log.slice(-3);
        } else if (args.length === 3) {
            [a, b, c] = args;
        } else if (args.length === 4 && isOptionsObject(args[3])) {
            [a, b, c] = args;
            ({ epsilon = 0.001 } = args[3]);
        } else {
            console.log("#getClockwiseDirection requires (), ({epsilon}), (a,b,c), or (a,b,c,{epsilon})");
            return "straight";
        }

        if (!a || !b || !c) {
            return "straight";
        }

        const cross = this.#vectorProducts(a, b, c).cross;

        if (cross > epsilon) {
            return "counterclockwise";
        }
        if (cross < -epsilon) {
            return "clockwise";
        }
        return "straight";
    }

    /**
     * Check to see if direction has changed.
     * @param {"straight"|"counterclockwise"|"clockwise"} dir1 - First direction.
     * @param {"straight"|"counterclockwise"|"clockwise"} dir2 - Second direction.
     * @returns {boolean}
     */
    #isDirectionChanged(dir1, dir2) {
        if (dir1 === "straight" || dir2 === "straight") return false;

        return dir1 !== dir2;
    }


    /**
     * Update all directional metrics: this.mostRecentDirection, 
     * this.clockwiseLength, this.counterclockwiseLength, 
     * & this.directionChangeCount
     * @param {number} distance - step distance from previous logged point.
     */
    #updateDirectionalMetrics(distance) {
        const currentDirection = this.#getClockwiseDirection();

        // Guard against impossible values
        if (
            currentDirection !== "straight" &&
            currentDirection !== "clockwise" &&
            currentDirection !== "counterclockwise"
        ) {
            console.warn(
                "direction must be 'counterclockwise', 'clockwise', or 'straight'"
            );
            return;
        }

        // Existance check: just set baseline and bail
        if (!this.mostRecentDirection) {
            this.mostRecentDirection = currentDirection;
            if (currentDirection === "counterclockwise") {
                this.counterClockwiseLength += distance;
            } else if (currentDirection === "clockwise") {
                this.clockwiseLength += distance;
            }
            return;
        }

        // Same direction as last time, or both straight
        if (
            currentDirection === "straight" ||
            currentDirection === this.mostRecentDirection
        ) {
            if (this.mostRecentDirection === "counterclockwise") {
                this.counterClockwiseLength += distance;
            } else if (this.mostRecentDirection === "clockwise") {
                this.clockwiseLength += distance;
            }
            //add nothing if both straight
            return;
        }

        // Direction changed (and is not straight here)
        this.directionChangeCount += 1;
        if (currentDirection === "counterclockwise") {
            this.counterClockwiseLength += distance;
        } else if (currentDirection === "clockwise") {
            this.clockwiseLength += distance;
        }
        this.mostRecentDirection = currentDirection;
    }


    /**
     * Update minimum & maximum bounding coordinates: this.#minX, this.#maxX,
     * this.#minY, and this.#maxY
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
