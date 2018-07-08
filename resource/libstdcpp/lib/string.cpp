#include <string.h>

unsigned int strlen(const char * str){
    unsigned int cnt = 0;
    while( *str != 0 ){
        str = str + 1;
        cnt = cnt + 1;
    }
    return cnt;
}