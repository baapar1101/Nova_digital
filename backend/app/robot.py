from __future__ import annotations

import math
import time
from dataclasses import dataclass, field


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def move_towards(current: float, target: float, max_delta: float) -> float:
    delta = target - current
    if abs(delta) <= max_delta:
        return target
    return current + math.copysign(max_delta, delta)


@dataclass
class Joint:
    position: float
    target: float
    minimum: float
    maximum: float
    max_velocity: float
    max_acceleration: float
    velocity: float = 0.0

    def set_target(self, target: float) -> None:
        self.target = clamp(target, self.minimum, self.maximum)

    def stop(self) -> None:
        self.target = self.position
        self.velocity = 0.0

    def step(self, dt: float) -> None:
        error = self.target - self.position

        if abs(error) < 1e-5 and abs(self.velocity) < 1e-4:
            self.position = self.target
            self.velocity = 0.0
            return

        braking_speed = math.sqrt(
            max(0.0, 2.0 * self.max_acceleration * abs(error))
        )
        desired_velocity = math.copysign(
            min(self.max_velocity, braking_speed),
            error,
        )

        self.velocity = move_towards(
            self.velocity,
            desired_velocity,
            self.max_acceleration * dt,
        )

        next_position = self.position + self.velocity * dt

        if (self.target - self.position) * (self.target - next_position) <= 0.0:
            self.position = self.target
            self.velocity = 0.0
        else:
            self.position = clamp(next_position, self.minimum, self.maximum)


@dataclass
class RobotSimulator:
    """Nova head motion model.

    Current mechanical definition:
      - head_pan: 180 degrees total travel, centered at zero (-90..+90)
      - head_tilt: home/base position at 0 degrees, travel to +45 degrees

    Angles exposed by the API are radians. The simulator deliberately models
    velocity and acceleration limits so the browser receives plausible servo
    motion rather than instantaneous angle jumps.
    """

    battery: float = 100.0
    seq: int = 0
    started_at: float = field(default_factory=time.monotonic)

    joints: dict[str, Joint] = field(
        default_factory=lambda: {
            "head_pan": Joint(
                position=0.0,
                target=0.0,
                minimum=math.radians(-90.0),
                maximum=math.radians(90.0),
                max_velocity=math.radians(105.0),
                max_acceleration=math.radians(300.0),
            ),
            "head_tilt": Joint(
                position=0.0,
                target=0.0,
                minimum=0.0,
                maximum=math.radians(45.0),
                max_velocity=math.radians(75.0),
                max_acceleration=math.radians(220.0),
            ),
        }
    )

    def set_joint_target(self, name: str, target: float) -> bool:
        joint = self.joints.get(name)
        if joint is None:
            return False
        joint.set_target(target)
        return True

    def home(self) -> None:
        for joint in self.joints.values():
            joint.set_target(0.0)

    def estop(self) -> None:
        for joint in self.joints.values():
            joint.stop()

    def step(self, dt: float) -> None:
        dt = clamp(dt, 0.0, 0.05)

        for joint in self.joints.values():
            joint.step(dt)

        motion_load = sum(
            abs(joint.velocity) / joint.max_velocity
            for joint in self.joints.values()
        ) / len(self.joints)

        self.battery = max(0.0, self.battery - motion_load * dt * 0.003)
        self.seq += 1

    def snapshot(self) -> dict:
        return {
            "type": "state",
            "mode": "simulation",
            "seq": self.seq,
            "timestamp": time.monotonic() - self.started_at,
            "joints": {
                name: joint.position for name, joint in self.joints.items()
            },
            "joint_targets": {
                name: joint.target for name, joint in self.joints.items()
            },
            "joint_velocity": {
                name: joint.velocity for name, joint in self.joints.items()
            },
            "joint_limits": {
                name: {
                    "min": joint.minimum,
                    "max": joint.maximum,
                }
                for name, joint in self.joints.items()
            },
            "battery": self.battery,
        }
