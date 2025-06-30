import { FrogTypes } from "../FrogTypes";

export default class Frog extends Phaser.Physics.Arcade.Sprite {
    private changeDirectionTimer = 0;
    private isSquishing = false;
    private isBeingDragged = false;
    private velocityX = 0;
    private velocityY = 0;
    private baseScale = 1;
    private mergeOutline?: Phaser.GameObjects.Graphics;

    private frog_type: keyof typeof FrogTypes;
    private particleEmitter: Phaser.GameObjects.Particles.ParticleEmitter;

    private static readonly CENTER_X = 512;
    private static readonly CENTER_Y = 410;
    private static readonly RADIUS_X = 460;
    private static readonly RADIUS_Y = 260;

    constructor(scene: Phaser.Scene, x: number, y: number, type: keyof typeof FrogTypes) {
        super(scene, x, y, `${type.toLowerCase()}`);
        this.frog_type = type;

        this.particleEmitter = scene.add.particles(this.x, this.y, 'dust', {
            speed: { min: -1000, max: 1000 },
            angle: { min: 0, max: 360 },
            scale: { start: 1, end: 2 },
            alpha: { start: 1, end: 0 },
            lifespan: 300,
            quantity: 80,
            blendMode: 'ADD'
        });

        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setCollideWorldBounds(false);
        this.setMaxVelocity(60, 60);
        this.setScale(this.baseScale);
        this.setInteractive({ useHandCursor: true });
        this.scene.input.setDraggable(this);

        this.on('dragstart', this.onDragStart, this);
        this.on('drag', this.onDrag, this);
        this.on('dragend', this.onDragEnd, this);

        this.particleEmitter.explode(10);
    }

    public getType(): keyof typeof FrogTypes {
        return this.frog_type;
    }

    update(delta: number) {
        this.setDepth(this.y);

        const { clampedX, clampedY, norm } = this.getClampedPosition(this.x, this.y);
        if (norm > 1) {
            this.setPosition(clampedX, clampedY);
            this.setVelocity(0, 0);
            this.body?.updateFromGameObject();
        }

        this.particleEmitter.setPosition(this.x, this.y);
        if (this.mergeOutline) this.mergeOutline.setPosition(this.x, this.y);
        if (this.isBeingDragged) return;

        this.changeDirectionTimer += delta;
        if (!this.isSquishing) this.squish();

        if (this.changeDirectionTimer > 2000) {
            this.velocityX = Phaser.Math.RND.pick([-1, 0, 1]) * Phaser.Math.Between(10, 30);
            this.velocityY = Phaser.Math.RND.pick([-1, 0, 1]) * Phaser.Math.Between(10, 30);
            this.setFlipX(this.velocityX < 0);
            this.changeDirectionTimer = 0;
        }

        this.setVelocity(this.velocityX, this.velocityY);
    }

    private getClampedPosition(x: number, y: number) {
        const radiusX = Frog.RADIUS_X - this.width * this.baseScale / 2;
        const radiusY = Frog.RADIUS_Y - this.height * this.baseScale / 2;
        const dx = x - Frog.CENTER_X;
        const dy = y - Frog.CENTER_Y;
        const norm = (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY);
        let clampedX = x;
        let clampedY = y;

        if (norm > 1) {
            const angle = Math.atan2(dy * radiusX, dx * radiusY);
            clampedX = Frog.CENTER_X + radiusX * Math.cos(angle);
            clampedY = Frog.CENTER_Y + radiusY * Math.sin(angle);
        }

        return { clampedX, clampedY, norm };
    }

    private onDragStart(pointer: Phaser.Input.Pointer) {
        this.isBeingDragged = true;
        this.setVelocity(0, 0);
        this.setTexture(`${this.frog_type.toLowerCase()}_carry`);

        const spriteTopMiddleY = pointer.y + (this.height * this.scaleY) / 2;
        this.setPosition(pointer.x, spriteTopMiddleY);
        this.body?.updateFromGameObject();
    }

    private onDrag(pointer: Phaser.Input.Pointer) {
        const adjustedY = pointer.y + (this.height * this.scaleY) / 2;
        const { clampedX, clampedY } = this.getClampedPosition(pointer.x, adjustedY);

        const deltaX = clampedX - this.x;
        if (Math.abs(deltaX) > 5) {
            this.setFlipX(deltaX < 0);
        }

        this.setPosition(clampedX, clampedY);
        this.body?.updateFromGameObject();
        this.checkMergeTargets();
    }

    private onDragEnd() {
        this.isBeingDragged = false;
        this.setTexture(`${this.frog_type.toLowerCase()}`);
        this.setOrigin(0.5);
        this.setDepth(this.y);
        this.tryMerge();
        this.clearMergeOutline();
    }

    private checkMergeTargets() {
        const frogs = (this.scene as any).frogs as Frog[];
        let target: Frog | null = null;

        for (const other of frogs) {
            if (other === this || other.frog_type !== this.frog_type) continue;
            if (Phaser.Geom.Intersects.RectangleToRectangle(this.getBounds(), other.getBounds())) {
                target = other;
                break;
            }
        }

        frogs.forEach(f => {
            f.mergeOutline?.destroy();
            f.mergeOutline = undefined;
        });

        if (target) {
            target.mergeOutline = this.scene.add.graphics();
            target.mergeOutline.lineStyle(4, 0xffff00);
            target.mergeOutline.strokeCircle(0, 0, target.width * target.baseScale / 2);
            target.mergeOutline.setPosition(target.x, target.y);
            target.mergeOutline.setDepth(target.depth + 1);
        }
    }

    private tryMerge() {
        const frogs = (this.scene as any).frogs as Frog[];
        const target = frogs.find(f => f !== this && f.frog_type === this.frog_type && f.mergeOutline);

        if (target) {
            const nextType = FrogTypes[this.frog_type];
            if (nextType) {
                target.frog_type = nextType;
                target.setTexture(`${nextType.toLowerCase()}`);
                target.particleEmitter.explode(10);

                this.scene.events.emit("frogMerged", nextType); // Notify scene
            }

            frogs.splice(frogs.indexOf(this), 1);
            target.mergeOutline?.destroy();
            target.mergeOutline = undefined;
            this.scene.time.delayedCall(0, () => this.destroy());
        }
    }

    private clearMergeOutline() {
        const frogs = (this.scene as any).frogs as Frog[];
        frogs.forEach(f => {
            f.mergeOutline?.destroy();
            f.mergeOutline = undefined;
        });
    }

    private squish() {
        this.isSquishing = true;
        this.scene.tweens.add({
            targets: this,
            scaleY: this.baseScale * 0.8,
            scaleX: this.baseScale * 1.1,
            duration: 150,
            yoyo: true,
            ease: 'Quad.easeInOut',
            onComplete: () => {
                this.isSquishing = false;
                this.setScale(this.baseScale);
            }
        });
    }
}
