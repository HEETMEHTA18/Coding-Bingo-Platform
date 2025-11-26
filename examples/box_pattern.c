// Example 3: Box Pattern in C
// Output: 4x4 box starting at (2,2)
#include <stdio.h>

int main() {
    printf("[");
    int first = 1;
    
    for (int x = 2; x <= 5; x++) {
        for (int y = 2; y <= 5; y++) {
            if (!first) printf(",");
            printf("[%d,%d]", x, y);
            first = 0;
        }
    }
    
    printf("]");
    return 0;
}
