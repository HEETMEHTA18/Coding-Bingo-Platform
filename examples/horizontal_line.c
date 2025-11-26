// Example 1: Horizontal Line in C
// Output: JSON array [[0,5],[1,5],...,[9,5]]
#include <stdio.h>

int main() {
    printf("[");
    for (int x = 0; x < 10; x++) {
        printf("[%d,5]", x);
        if (x < 9) printf(",");
    }
    printf("]");
    return 0;
}
