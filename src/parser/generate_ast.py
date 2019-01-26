import os

a = [[x[0] + '/' + y.split('.ts')[0] for y in x[2]] for x in os.walk('../codegen')]
b = ['export * from "../' + x + '";' for x in sum(a, [])]
print "\n".join(b)