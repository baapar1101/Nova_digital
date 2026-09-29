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

    def set_target(self, target: float) -> None:
        self.target = clamp(target, self.minimum, self.maximum)

    def step(self, dt: float) -> None:
        self.position = move_towards(
            self.position,
            self.target,
            self.max_velocity * dt,
        )


@dataclass
class RobotSimulator:
    """Small kinematic simulator used until the MuJoCo model is available.

    The public state/command interface is intentionally independent of this
    implementation so it can later be replaced with MuJoCo or ROS 2.
    """

    track_width: float = 0.82
    max_track_speed: float = 1.20
    track_acceleration: float = 2.40
    command_timeout: float = 0.75

    x: float = 0.0
    z: float = 0.0
    yaw: float = 0.0

    left_velocity: float = 0.0
    right_velocity: float = 0.0
    left_target: float = 0.0
    right_target: float = 0.0

    battery: float = 100.0
    seq: int = 0
    started_at: float = field(default_factory=time.monotonic)
    last_drive_command: float = field(default_factory=time.monotonic)

    joints: dict[str, Joint] = field(
        default_factory=lambda: {
            "arm_base": Joint(0.0, 0.0, -math.pi, math.pi, 1.5),
            "shoulder": Joint(0.55, 0.55, -0.5, 1.45, 1.2),
            "elbow": Joint(-1.0, -1.0, -2.2, 0.2, 1.5),
            "wrist": Joint(0.35, 0.35, -1.6, 1.6, 2.0),
        }
    )

    def set_drive(self, left: float, right: float) -> None:
        """Set normalized track targets in the range [-1, 1]."""
        self.left_target = clamp(left, -1.0, 1.0) * self.max_track_speed
        self.right_target = clamp(right, -1.0, 1.0) * self.max_track_speed
        self.last_drive_command = time.monotonic()

    def estop(self) -> None:
        self.left_target = 0.0
        self.right_target = 0.0
        self.left_velocity = 0.0
        self.right_velocity = 0.0
        self.last_drive_command = time.monotonic()

    def reset_pose(self) -> None:
        self.x = 0.0
        self.z = 0.0
        self.yaw = 0.0
        self.estop()

    def set_joint_target(self, name: str, target: float) -> bool:
        joint = self.joints.get(name)
        if joint is None:
            return False
        joint.set_target(target)
        return True

    def step(self, dt: float) -> None:
        dt = clamp(dt, 0.0, 0.05)

        if time.monotonic() - self.last_drive_command > self.command_timeout:
            self.left_target = 0.0
            self.right_target = 0.0

        max_track_delta = self.track_acceleration * dt
        self.left_velocity = move_towards(
            self.left_velocity, self.left_target, max_track_delta
        )
        self.right_velocity = move_towards(
            self.right_velocity, self.right_target, max_track_delta
        )

        linear = (self.left_velocity + self.right_velocity) * 0.5
        angular = (self.right_velocity - self.left_velocity) / self.track_width

        self.yaw += angular * dt
        self.yaw = math.atan2(math.sin(self.yaw), math.cos(self.yaw))

        self.x += linear * math.cos(self.yaw) * dt
        self.z += linear * math.sin(self.yaw) * dt

        for joint in self.joints.values():
            joint.step(dt)

        activity = (
            abs(self.left_velocity) + abs(self.right_velocity)
        ) / (2.0 * self.max_track_speed)
        self.battery = max(0.0, self.battery - activity * dt * 0.005)
        self.seq += 1

    def snapshot(self) -> dict:
        linear = (self.left_velocity + self.right_velocity) * 0.5
        angular = (self.right_velocity - self.left_velocity) / self.track_width

        return {
            "type": "state",
            "seq": self.seq,
            "timestamp": time.monotonic() - self.started_at,
            "pose": {
                "x": self.x,
                "y": 0.0,
                "z": self.z,
                "yaw": self.yaw,
            },
            "velocity": {
                "linear": linear,
                "angular": angular,
            },
            "tracks": {
                "left": self.left_velocity,
                "right": self.right_velocity,
                "left_target": self.left_target,
                "right_target": self.right_target,
            },
            "joints": {
                name: joint.position for name, joint in self.joints.items()
            },
            "battery": self.battery,
        }
