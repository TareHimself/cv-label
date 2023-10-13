









x = [(11.63,17.44),(11.08,17.33),(11.58,16.92)]
total = 0
for initial, final in x:
    t = ((final - initial) / initial) * 100
    total  = total + t
    print(t)
print(total / 3)