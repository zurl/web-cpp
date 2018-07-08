#include <stdio.h>
#include <stdarg.h>
#include <syscall.h>
#include <string.h>

int puts(const char * str){
    write(1, str, strlen(str));
}

