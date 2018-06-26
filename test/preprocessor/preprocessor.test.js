// TODO:: write some case
const source = `#include <math.h>
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
#if ABCD == 2
"Should Exists 3"
#else
"Should Not Exists 3"
#endif
ABCD
#undef ABCD
ABCD
`;
const result = `"Should Exists 1"
"Should Exists 2"
"Should Exists 3"
2
ABCD
`;
const Preprocess = require('../../dist/preprocessor').default;
const Assert = require('chai');

describe('preprocessor', function(){
    it('preprocessor should works', async function(){

        const fileName = "testFile";
        const MathH = "";

        const {code} = Preprocess.process(fileName, source);
        Assert.assert.equal(code, MathH + result)
    })
});
