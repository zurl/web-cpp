// TODO:: write some case

const {preprocess, parseMarco} = require("../../dist/preprocessor/index");
const {SourceMapConsumer} = require("source-map");
const {assert} = require("chai");
const source = `
dosth
#define foo(a,b,c) a+b+c
foo(doo(1),doo(2,3,4),3)
#define salty doo
salty fish
`

function arrayEqual(arr1, arr2){
    assert.equal(JSON.stringify(arr1), JSON.stringify(arr2));
}

    const source2 = `
#ifdef A
"Should Not Exists 1"
#endif
#ifndef A
"Should Exists 1"
#endif
#define A
#ifdef A
"Should Exists 2"
#endif
#ifndef A
"Should Not Exists 2"
#endif
#define ABCD 2
ABCD
#undef ABCD
ABCD
`;
const result = `
"Should Exists 1"
"Should Exists 2"
2
ABCD

`;
const {Headers} = require("../../dist/library/index");
describe('preprocessor', function(){
    it('preprocessor should works', async function(){

        const fileName = "testFile";
        const {code} = preprocess(fileName, source2);
        assert.equal(code,result)
    });
    it('parse marco', function () {
        arrayEqual(
            parseMarco(["foo", "luu", "goo"], "foo goo luu"),
            [ 0, ' ', 2, ' ', 1 ]);
        arrayEqual(
            parseMarco(["foo", "luu", "goo"], "foo##goo luu"),
            [ 0, 2, ' ', 1 ]);
        arrayEqual(
            parseMarco(["foo", "luu", "goo"], "foo#goo luu"),
            [ 0,"\"", 2, '\" ', 1 ]);
    });
});
