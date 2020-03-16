#include <time.h>
#include <stdio.h>
double work(int n){
    double sum = 0.0;
    int sign = 1;
    for (int i = 0; i < n; ++i) {
        sum += sign/(2.0*i+1.0);
        sign *= -1;
    }
    return 4.0*sum;
}

int main(){
    int st_time = time(0);
    double result = work(1000000000);
    int ed_time = time(0);
    printf("pi=%lf\n", result);
    printf("finish in %d seconds\n", ed_time - st_time);
    return 0;
}