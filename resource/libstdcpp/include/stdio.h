#ifndef _STDIO_H
#define _STDIO_H

__libcall void dump_stack_info();


__libcall int scanf(const char * format, ...);
__libcall int printf(const char * format, ...);
__libcall int getchar();
int puts(const char * str);

#endif