import math

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

# Initial state: driving at 50 km/h (13.88 m/s)
vLong = 13.88
vLat = 0.0
yawRate = 0.0
steerAngle = 0.0
carHeadingAngle = 0.0

dt = 1.0 / 60.0

# User presses Left (input.left = 1) for 2 seconds (120 frames)
for frame in range(120):
    # processInputs
    speedKmh = abs(vLong * 3.6)
    speedFactor = 1.0 / (1.0 + (speedKmh / 80.0)**1.2)
    maxSteer = 0.32 + (0.62 - 0.32) * speedFactor
    rawSteerInput = 1.0 # Left
    targetSteer = rawSteerInput * maxSteer
    isCounterSteer = (vLat * rawSteerInput < -0.1)
    steerSpeed = 24.0 if isCounterSteer else 16.0
    steerAngle += (targetSteer - steerAngle) * min(1.0, steerSpeed * dt)

    # computePhysicsForces
    staticLoadFront = (rearAxleDist / wheelbase) * mass * g
    staticLoadRear = (frontAxleDist / wheelbase) * mass * g
    downforce = 0.5 * 1.8 * (vLong * vLong)
    fzFront = max(1000, staticLoadFront + downforce * 0.45)
    fzRear = max(1000, staticLoadRear + downforce * 0.55)

    denomSpeed = max(1.2, abs(vLong))
    alphaFront = math.atan2(vLat + (frontAxleDist * yawRate), denomSpeed) - steerAngle
    alphaRear = math.atan2(vLat - (rearAxleDist * yawRate), denomSpeed)

    maxLatFront = baseGripFront * fzFront
    maxLatRear = baseGripRear * fzRear

    def clamp(val, low, high):
        return max(low, min(val, high))

    fLatFront = -clamp(corneringStiffnessFront * alphaFront, -maxLatFront, maxLatFront)
    fLatRear = -clamp(corneringStiffnessRear * alphaRear, -maxLatRear, maxLatRear)

    yawTorque = (frontAxleDist * fLatFront * math.cos(steerAngle)) - (rearAxleDist * fLatRear)
    yawDamping = -yawRate * (1150 + abs(vLong) * 85)
    yawAccel = (yawTorque + yawDamping) / inertia

    aLat = ((fLatFront * math.cos(steerAngle)) + fLatRear) / mass - (yawRate * vLong)
    
    vLong += 0 # maintain speed
    vLat += aLat * dt
    yawRate += yawAccel * dt
    carHeadingAngle += yawRate * dt

    if frame % 20 == 0:
        print(f"Frame {frame:3d}: steer={steerAngle:.3f} rad ({math.degrees(steerAngle):.1f} deg), yawRate={yawRate:.3f} rad/s, heading={carHeadingAngle:.3f} rad ({math.degrees(carHeadingAngle):.1f} deg), vLat={vLat:.3f} m/s")
