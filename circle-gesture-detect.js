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

class PointSample {
    constructor(x, y, t) {
        this.x = x;
        this.y = y;
        this.t = t;
    }

    /**
     * Return Euclidean distance between two points
     * @param {PointSample} other - the other point for comparison
     * @returns {number} Euclidean distance
     */
    distance(other) {
        return Math.sqrt((other.x - this.x)**2 + (other.y - this.y)**2)
    }

}

class SampleLog {
    constructor(start) {
        this.start = start;
        this.log = [start];
        this.dydx = []
        this.d2ydx2 = []
        this.dxdt = []
        this.dydt = []
    }


    add(point) {
        //TODO calculate derivatives
        //add point last
        this.log.push(point);
    }


}