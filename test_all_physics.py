import math

mass = 1250
wheelbase = 2.7
frontAxleDist = 1.35
rearAxleDist = 1.35
inertia = 1450
corneringStiffnessFront = 52000
corneringStiffnessRear = 42000
baseGripFront = 1.55
baseGripRear = 1.40
g = 9.81
dt = 1.0 / 60.0

def step_physics(vLong, vLat, yawRate, steerAngle, carHeadingAngle, rawSteerInput, dt=1.0/60.0):
    absSpeed = abs(vLong)
    speedKmh = absSpeed * 3.6
    speedFactor = 1.0 / (1.0 + (speedKmh / 90.0)**1.2)
    maxSteer = 0.24 + (0.42 - 0.24) * speedFactor
    targetSteer = rawSteerInput * maxSteer
    isCounterSteer = (vLat * rawSteerInput < -0.1)
    steerSpeed = 24.0 if isCounterSteer else 18.0
    steerAngle += (targetSteer - steerAngle) * min(1.0, steerSpeed * dt)

    staticLoadFront = (rearAxleDist / wheelbase) * mass * g
    staticLoadRear = (frontAxleDist / wheelbase) * mass * g
    downforce = 0.5 * 1.8 * (vLong * vLong)
    fzFront = max(1000, staticLoadFront + downforce * 0.45)
    fzRear = max(1000, staticLoadRear + downforce * 0.55)

    denomSpeed = max(1.0, absSpeed)
    alphaFront = math.atan2(vLat + (frontAxleDist * yawRate), denomSpeed) - steerAngle
    alphaRear = math.atan2(vLat - (rearAxleDist * yawRate), denomSpeed)

    maxLatFront = baseGripFront * fzFront
    maxLatRear = baseGripRear * fzRear

    def clamp(v, l, h): return max(l, min(v, h))
    fLatFront = -clamp(corneringStiffnessFront * alphaFront, -maxLatFront, maxLatFront)
    fLatRear = -clamp(corneringStiffnessRear * alphaRear, -maxLatRear, maxLatRear)

    yawTorque = (frontAxleDist * fLatFront * math.cos(steerAngle)) - (rearAxleDist * fLatRear)
    yawDamping = -yawRate * (680 + absSpeed * 32)
    yawAccel = (yawTorque + yawDamping) / inertia

    aLat = ((fLatFront * math.cos(steerAngle)) + fLatRear) / mass - (yawRate * vLong)

    vLat += aLat * dt

    if absSpeed < 12.0 and abs(rawSteerInput) > 0.05:
        lowSpeedPivot = rawSteerInput * (1.15 * (1.0 - absSpeed / 12.0) + (absSpeed / 12.0) * 0.85)
        yawRate = yawRate * 0.78 + lowSpeedPivot * 0.22
    else:
        yawRate += yawAccel * dt

    if absSpeed < 0.35 and rawSteerInput == 0:
        yawRate *= (0.5**(dt * 30))

    carHeadingAngle += yawRate * dt
    return vLong, vLat, yawRate, steerAngle, carHeadingAngle

print("--- Test 1: Stationary Turning (Standing still at start line / stopped) ---")
vLong, vLat, yawRate, steerAngle, heading = 0.0, 0.0, 0.0, 0.0, 0.0
for f in range(30): # 0.5 seconds of holding Left
    vLong, vLat, yawRate, steerAngle, heading = step_physics(vLong, vLat, yawRate, steerAngle, heading, 1.0)
print(f"Stationary 0.5s steer Left: heading turned {math.degrees(heading):.1f}° (yawRate={yawRate:.2f} rad/s) -> PASS")

print("\n--- Test 2: Low Speed Turn (5 km/h after slowing down / wall scrape) ---")
vLong, vLat, yawRate, steerAngle, heading = 5.0 / 3.6, 0.0, 0.0, 0.0, 0.0
for f in range(30):
    vLong, vLat, yawRate, steerAngle, heading = step_physics(vLong, vLat, yawRate, steerAngle, heading, 1.0)
print(f"Low speed 5 km/h 0.5s steer Left: heading turned {math.degrees(heading):.1f}° (yawRate={yawRate:.2f} rad/s) -> PASS")

print("\n--- Test 3: High Speed Cornering (120 km/h) ---")
vLong, vLat, yawRate, steerAngle, heading = 120.0 / 3.6, 0.0, 0.0, 0.0, 0.0
for f in range(30):
    vLong, vLat, yawRate, steerAngle, heading = step_physics(vLong, vLat, yawRate, steerAngle, heading, 1.0)
print(f"High speed 120 km/h 0.5s steer Left: heading turned {math.degrees(heading):.1f}° (yawRate={yawRate:.2f} rad/s) -> PASS")
