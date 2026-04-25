// ===== VEHICLE CLASS =====
// Handles individual vehicle rendering, movement, and traffic light response

class Vehicle {
  static COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f97316', '#64748b', '#ec4899', '#6366f1'];
  static WIDTH = 16;
  static LENGTH = 28;
  static EMERGENCY_COLOR = '#ef4444';

  constructor(direction, lane, isEmergency = false) {
    this.direction = direction; // 'north', 'south', 'east', 'west'
    this.lane = lane; // 0 or 1
    this.isEmergency = isEmergency;
    this.color = isEmergency ? Vehicle.EMERGENCY_COLOR : Vehicle.COLORS[Math.floor(Math.random() * Vehicle.COLORS.length)];
    this.speed = 1.5 + Math.random() * 1;
    this.maxSpeed = this.speed;
    this.currentSpeed = this.speed;
    this.stopped = false;
    this.passed = false; // has passed the intersection
    this.removed = false;

    // Set initial position based on direction
    this._initPosition();
  }

  _initPosition() {
    const center = 300; // canvas center
    const roadWidth = 80;
    const laneOffset = this.lane === 0 ? -20 : -6;

    switch (this.direction) {
      case 'north': // moving up (from bottom)
        this.x = center + 8 + this.lane * 14;
        this.y = 620;
        this.angle = -Math.PI / 2;
        break;
      case 'south': // moving down (from top)
        this.x = center - 22 + this.lane * 14;
        this.y = -20;
        this.angle = Math.PI / 2;
        break;
      case 'east': // moving right (from left)
        this.x = -20;
        this.y = center + 8 + this.lane * 14;
        this.angle = 0;
        break;
      case 'west': // moving left (from right)
        this.x = 620;
        this.y = center - 22 + this.lane * 14;
        this.angle = Math.PI;
        break;
    }
  }

  // Get stop line position for this vehicle's direction
  _getStopLine() {
    const center = 300;
    const offset = 58;
    switch (this.direction) {
      case 'north': return center + offset;
      case 'south': return center - offset;
      case 'east': return center - offset;
      case 'west': return center + offset;
    }
  }

  // Check if vehicle is approaching stop line
  _isApproachingStopLine() {
    const stop = this._getStopLine();
    const margin = 30;
    switch (this.direction) {
      case 'north': return this.y > stop && this.y < stop + margin * 3;
      case 'south': return this.y < stop && this.y > stop - margin * 3;
      case 'east': return this.x < stop && this.x > stop - margin * 3;
      case 'west': return this.x > stop && this.x < stop + margin * 3;
    }
  }

  // Check if vehicle has passed the intersection
  _hasPassed() {
    const stop = this._getStopLine();
    switch (this.direction) {
      case 'north': return this.y < stop - 10;
      case 'south': return this.y > stop + 10;
      case 'east': return this.x > stop + 10;
      case 'west': return this.x < stop - 10;
    }
  }

  // Update vehicle position
  update(signal, vehiclesAhead) {
    if (this.removed) return;

    // Check if passed intersection
    if (this._hasPassed()) this.passed = true;

    // Check for vehicle ahead (queue behavior)
    let tooClose = false;
    for (const v of vehiclesAhead) {
      if (v === this || v.removed) continue;
      if (v.direction !== this.direction || v.lane !== this.lane) continue;
      const dist = this._distanceTo(v);
      if (dist > 0 && dist < 38) { tooClose = true; break; }
    }

    // Should stop at red/yellow light?
    const shouldStop = !this.passed && signal !== 'green' && this._isApproachingStopLine();

    if (shouldStop || tooClose) {
      this.currentSpeed = Math.max(0, this.currentSpeed - 0.15);
      this.stopped = this.currentSpeed < 0.1;
    } else {
      this.currentSpeed = Math.min(this.maxSpeed, this.currentSpeed + 0.08);
      this.stopped = false;
    }

    // Move
    switch (this.direction) {
      case 'north': this.y -= this.currentSpeed; break;
      case 'south': this.y += this.currentSpeed; break;
      case 'east': this.x += this.currentSpeed; break;
      case 'west': this.x -= this.currentSpeed; break;
    }

    // Remove if off screen
    if (this.x < -40 || this.x > 640 || this.y < -40 || this.y > 640) {
      this.removed = true;
    }
  }

  _distanceTo(other) {
    switch (this.direction) {
      case 'north': return this.y - other.y;
      case 'south': return other.y - this.y;
      case 'east': return other.x - this.x;
      case 'west': return this.x - other.x;
    }
  }

  // Draw vehicle on canvas
  draw(ctx) {
    if (this.removed) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Car body
    const w = Vehicle.LENGTH;
    const h = Vehicle.WIDTH;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 4);
    ctx.fill();

    // Windshield
    ctx.fillStyle = 'rgba(200,220,255,0.5)';
    ctx.fillRect(w / 2 - 8, -h / 2 + 2, 6, h - 4);

    // Emergency lights
    if (this.isEmergency) {
      const flash = Date.now() % 500 < 250;
      ctx.fillStyle = flash ? '#fff' : '#3b82f6';
      ctx.fillRect(-3, -h / 2 - 2, 6, 4);
      ctx.fillStyle = flash ? '#3b82f6' : '#fff';
      ctx.fillRect(-3, h / 2 - 2, 6, 4);
    }

    ctx.restore();
  }
}
