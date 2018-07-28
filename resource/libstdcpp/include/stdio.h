#ifndef _STDIO_H
#define _STDIO_H

__libcall void dump_stack_info();
__libcall int printf(const char * format, ...);
int puts(const char * str);
int put_integer(int x);

#endif