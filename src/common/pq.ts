/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 07/07/2018
 */

export type Comparator<T> = (lhs: T, rhs: T) => number;

export class PriorityQueue<T> {
    private readonly data: T[];
    private length: number;
    private readonly cmp: Comparator<T>;

    constructor(cmp: Comparator<T>) {
        this.data = [];
        this.length = 0;
        this.cmp = cmp;
    }

    public peak(): T {
        return this.data[0];
    }

    public push(value: T): number {
        this.data.push(value);
        let pos = this.data.length - 1, parent, x;
        while (pos > 0) {
            parent = (pos - 1) >>> 1;
            if (this.cmp(this.data[pos], this.data[parent]) < 0) {
                x = this.data[parent];
                this.data[parent] = this.data[pos];
                this.data[pos] = x;
                pos = parent;
            } else {
                break;
            }
        }
        return this.length++;
    }

    public pop(): T {
        const last_val = this.data.pop() as T;
        let ret = this.data[0];
        if (this.data.length > 0) {
            this.data[0] = last_val;
            let pos = 0, left, right, minIndex, x;
            const last = this.data.length - 1;
            while (1) {
                left = (pos << 1) + 1;
                right = left + 1;
                minIndex = pos;
                if (left <= last && this.cmp(this.data[left], this.data[minIndex]) < 0) {
                    minIndex = left;
                }
                if (right <= last && this.cmp(this.data[right], this.data[minIndex]) < 0) {
                    minIndex = right;
                }
                if (minIndex !== pos) {
                    x = this.data[minIndex];
                    this.data[minIndex] = this.data[pos];
                    this.data[pos] = x;
                    pos = minIndex;
                } else {
                    break;
                }
            }
        } else {
            ret = last_val;
        }
        this.length--;
        return ret;
    }

    public size() {
        return this.length;
    }
}
