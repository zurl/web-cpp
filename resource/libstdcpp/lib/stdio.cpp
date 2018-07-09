#include <stdio.h>
#include <stdarg.h>
#include <syscall.h>
#include <string.h>

int puts(const char * str){
    int len = strlen(str);
    write(1, str, len);
    return len;
}

