/**
 *  @file
 *  @author zcy <zurl@live.com>
 *  Created at 03/07/2018
 */

export const string_h = `
void strcpy(const char *dst, const char *src);
`;

export const string_impl = `
void strcpy(const char *dst, const char *src){
    while( *dst++ = *src++ );
}
`;
