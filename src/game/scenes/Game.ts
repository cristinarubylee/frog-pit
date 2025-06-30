import { Scene } from 'phaser';
import Frog from '../models/Frog';
import { FrogTypes } from '../FrogTypes';

export class Game extends Scene {
    camera!: Phaser.Cameras.Scene2D.Camera;
    background!: Phaser.GameObjects.Image;
    frogs: Frog[] = [];
    statsText!: Phaser.GameObjects.Text;

    private spawnTimer = 0;
    private spawnInterval = 3000;

    private mostAdvancedType: keyof typeof FrogTypes = 'Water';

    private static readonly CENTER_X = 512;
    private static readonly CENTER_Y = 410;
    private static readonly RADIUS_X = 400;
    private static readonly RADIUS_Y = 200;

    constructor() {
        super('Game');
    }

    create() {
        this.frogs = [];
        this.spawnTimer = 0;

        this.camera = this.cameras.main;
        this.background = this.add.image(512, 384, 'bg');

        this.statsText = this.add.text(20, 20, '', {
            fontSize: '20px',
            color: '#ffffff',
            fontFamily: 'Arial'
        });

        this.events.on("frogMerged", this.onFrogMerged, this);
        this.spawnFrog();
    }

    update(_: number, delta: number) {
        this.frogs.forEach(f => f.update(delta));
        this.spawnTimer += delta;

        if (this.spawnTimer > this.spawnInterval) {
            this.spawnFrog();
            this.spawnTimer = 0;
            this.spawnInterval = Math.min(1000, this.frogs.length * 50);
        }

        if (this.frogs.length > 30) {
            this.scene.start('GameOver');
        }

        this.updateStats();
    }

    private spawnFrog() {
        const { x, y } = this.getRandomPositionInEllipse();
        const frog = new Frog(this, x, y, 'Flower');
        this.frogs.push(frog);
    }

    private getRandomPositionInEllipse(): { x: number, y: number } {
        let x, y;
        do {
            x = Game.CENTER_X + (Math.random() - 0.5) * 2 * Game.RADIUS_X;
            y = Game.CENTER_Y + (Math.random() - 0.5) * 2 * Game.RADIUS_Y;

            const dx = x - Game.CENTER_X;
            const dy = y - Game.CENTER_Y;
            const norm = (dx * dx) / (Game.RADIUS_X * Game.RADIUS_X) + (dy * dy) / (Game.RADIUS_Y * Game.RADIUS_Y);
            if (norm <= 1) break;
        } while (true);
        return { x, y };
    }

    private onFrogMerged(newType: keyof typeof FrogTypes) {
        const order = Object.keys(FrogTypes);
        if (order.indexOf(newType) > order.indexOf(this.mostAdvancedType)) {
            this.mostAdvancedType = newType;
        }
    }

    private updateStats() {
        this.statsText.setText(`Frogs: ${this.frogs.length}\nCurrent Type: ${this.mostAdvancedType}`);
    }
}
