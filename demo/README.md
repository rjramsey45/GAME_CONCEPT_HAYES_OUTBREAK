# Hayes Outbreak Demo (Browser Prototype)

A creative, runnable sandbox demo inspired by your vision: GTA-style free roam in a fictional Hays/FHSU-centered city with zombies, points, upgrades, weapon pickups, and drivable muscle cars.

## Run locally

```bash
cd demo
python3 -m http.server 4173
```

Then open:
- `http://localhost:4173`

## Controls
- `WASD`: Move / drive
- `Mouse`: Aim
- `Left click`: Shoot
- `Shift`: Sprint
- `E`: Enter/exit nearby car
- `F`: Interact with safehouse shop
- `1/2/3`: Switch weapon (if unlocked)
- `R`: Reload animation (for non-pistol weapons)

## Included gameplay systems
- Open-world districts (University Core, Downtown Hayes, etc.)
- Zombie archetypes (Rusher, Bruiser, Shrieker)
- Threat escalation system (1–5)
- Weapon pickups and unlocks
- Points economy + safehouse upgrades
- Car driving, car durability, and zombie collision tradeoffs
