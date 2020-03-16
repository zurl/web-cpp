#ifndef _CTYPE_H
#define _CTYPE_H

__libcall int isalnum(int);
__libcall int isalpha(int);
__libcall int isblank(int);
__libcall int iscntrl(int);
__libcall int isdigit(int);
__libcall int isgraph(int);
__libcall int islower(int);
__libcall int isprint(int);
__libcall int ispunct(int);
__libcall int isspace(int);
__libcall int isupper(int);
__libcall int isxdigit(int);
__libcall int tolower(int);
__libcall int toupper(int);

#undef