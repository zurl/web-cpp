#ifndef _SYSCALL_H
#define _SYSCALL_H

__libcall int write(unsigned int fd, void * buffer, unsigned int size);
__libcall int read(unsigned int fd, void * buffer, unsigned int size);
__libcall void memcpy(void * dst, void * src, unsigned int size);
__libcall void * malloc(unsigned int size);
__libcall void free(void * ptr);
__libcall void * malloc_array(unsigned int element_size, unsigned int length);
#endif