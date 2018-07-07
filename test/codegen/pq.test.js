const {PriorityQueue} = require("../../dist/common/pq");
const {assert} = require("chai");
describe('priority queue', function () {
    it('should works', function () {
        const pq = new PriorityQueue(function(lhs, rhs){
            return lhs - rhs;
        });

        pq.push(1);
        pq.push(9);
        pq.push(7);
        pq.push(8);

        const result = [];
        result.push(pq.pop());
        result.push(pq.pop());
        result.push(pq.pop());
        result.push(pq.pop());
        assert.equal(JSON.stringify(result), JSON.stringify([1, 7, 8, 9]));
    })
});