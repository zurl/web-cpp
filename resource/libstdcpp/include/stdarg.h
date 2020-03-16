#ifndef _STDARG_H
#define _STDARG_H

typedef void* va_list;
#define va_start(ptr,arg) (ptr) = &(arg) + sizeof(arg) + 4
#define va_arg(ptr,type) ((ptr) += sizeof(type), *((type *)(ptr - sizeof(type))))
#define va_end(ptr) (ptr) = 0;

#endif