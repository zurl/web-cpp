#ifndef _STRING_H
#define _STRING_H

typedef unsigned int size_t;
__libcall int    memcmp(const void *, const void *, size_t);
__libcall void*  memcpy(void *, const void *, size_t);
__libcall void*  memset(void *, int, size_t);
__libcall void*  memmove(void *, const void *, size_t);

__libcall char*  strcpy(char *, const char *);
__libcall int    strcmp(const char *, const char *);
__libcall char*  strcat(char *, const char *);
__libcall size_t strlen(const char *);
__libcall char*  strchr(const char *, int);
__libcall char*  strncat(char *, const char *, size_t);
__libcall int    strncmp(const char *, const char *, size_t);
__libcall char*  strncpy(char *, const char *, size_t);

/*
__libcall void*  memccpy(void *, const void *, int, size_t);
__libcall void*  memchr(const void *, int, size_t);
__libcall int    strcoll(const char *, const char *);
__libcall size_t strcspn(const char *, const char *);
__libcall char*  strdup(const char *);
__libcall char*  strerror(int);
__libcall char*  strpbrk(const char *, const char *);
__libcall char*  strrchr(const char *, int);
__libcall size_t strspn(const char *, const char *);
__libcall char*  strstr(const char *, const char *);
__libcall char*  strtok(char *, const char *);
__libcall char*  strtok_r(char *, const char *, char **);
__libcall size_t strxfrm(char *, const char *, size_t);
*/

#endif