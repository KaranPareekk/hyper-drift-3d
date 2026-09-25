import math

# Simulate track: straight track along Z:
# tangent = (0, 0, -1)
# binormal = (1, 0, 0)
# normal = (0, 1, 0)

mass = 1250
wheelbase = 2.7
frontAxleDist = 1.35
rearAxleDist = 1.35
inertia = 1750
corneringStiffnessFront = 38000
corneringStiffnessRear = 40000
baseGripFront = 1.35
baseGripRear = 1.40
g = 9.81

# Car starting at center of track (x=0, z=0), speed = 20 m/s (72 km/h)
vLong = 20.0
vLat = 0.0
yawRate = 0.0
steerAngle = 0.0
carHeadingAngle = 0.0

posX = 0.0 # signed lateral dist (binormal)
posZ = 0.0 # distance along track (-tangent)

dt = 1.0 / 60.0

print("Simulating steering LEFT (A / Left arrow) at 72 km/h:")
for frame in range(120): # 2 seconds
    # Input: Steer LEFT
    rawSteerInput = 1.0
    speedKmh = abs(vLong * 3.6)
    speedFactor = 1.0 / (1.0 + (speedKmh / 80.0)**1.2)
    maxSteer = 0.32 + (0.62 - 0.32) * speedFactor
    targetSteer = rawSteerInput * maxSteer
    isCounterSteer = (vLat * rawSteerInput < -0.1)
    steerSpeed = 24.0 if isCounterSteer else 16.0
    steerAngle += (targetSteer - steerAngle) * min(1.0, steerSpeed * dt)

    # Lateral tire slip
    denomSpeed = max(1.2, abs(vLong))
    alphaFront = math.atan2(vLat + (frontAxleDist * yawRate), denomSpeed) - steerAngle
    alphaRear = math.atan2(vLat - (rearAxleDist * yawRate), denomSpeed)

    staticLoadFront = (rearAxleDist / wheelbase) * mass * g
    staticLoadRear = (frontAxleDist / wheelbase) * mass * g
    fzFront = max(1000, staticLoadFront)
    fzRear = max(1000, staticLoadRear)

    maxLatFront = baseGripFront * fzFront
    maxLatRear = baseGripRear * fzRear

    def clamp(v, l, h): return max(l, min(v, h))
    fLatFront = -clamp(corneringStiffnessFront * alphaFront, -maxLatFront, maxLatFront)
    fLatRear = -clamp(corneringStiffnessRear * alphaRear, -maxLatRear, maxLatRear)

    yawTorque = (frontAxleDist * fLatFront * math.cos(steerAngle)) - (rearAxleDist * fLatRear)
    yawDamping = -yawRate * (1150 + abs(vLong) * 85)
    yawAccel = (yawTorque + yawDamping) / inertia

    aLat = ((fLatFront * math.cos(steerAngle)) + fLatRear) / mass - (yawRate * vLong)

    vLat += aLat * dt
    yawRate += yawAccel * dt
    carHeadingAngle += yawRate * dt

    # integrateMovement
    # T = (0, 0, -1), B = (1, 0, 0)
    # _carForward = T * cosH - B * sinH = (-sinH, 0, -cosH)
    # _carRight = B * cosH + T * sinH = (cosH, 0, -sinH)
    cosH = math.cos(carHeadingAngle)
    sinH = math.sin(carHeadingAngle)
    carForwardX = -sinH
    carForwardZ = -cosH
    carRightX = cosH
    carRightZ = -sinH

    dx = (carForwardX * vLong + carRightX * vLat) * dt
    dz = (carForwardZ * vLong + carRightZ * vLat) * dt

    posX += dx # X is along binormal (lateral distance)
    posZ += dz

    if frame % 20 == 0:
        print(f"t={frame*dt:.2f}s: steer={math.degrees(steerAngle):.1f}°, yawRate={yawRate:.2f}r/s, heading={math.degrees(carHeadingAngle):.1f}°, posX={posX:.2f}m (lateral dist), vLat={vLat:.2f}m/s")
