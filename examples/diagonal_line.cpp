// Example 2: Diagonal Line in C++
// Output: JSON array [[0,0],[1,1],...,[9,9]]
#include <iostream>
using namespace std;

int main() {
    cout << "[";
    for (int i = 0; i < 10; i++) {
        cout << "[" << i << "," << i << "]";
        if (i < 9) cout << ",";
    }
    cout << "]";
    return 0;
}
