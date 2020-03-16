#ifndef _STDLIB_H
#define _STDLIB_H

__libcall void *malloc(unsigned int num_bytes);
__libcall void *memset(void * ptr, int ch, unsigned int num_bytes);
__libcall void free(void * ptr);
__libcall void srand( unsigned seed ):
__libcall int rand():

#endif