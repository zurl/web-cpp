#ifndef _SYSCALL_H
#define _SYSCALL_H

__libcall int write(unsigned int fd, void * buffer, unsigned int size);
__libcall int read(unsigned int fd, void * buffer, unsigned int size);

#endif