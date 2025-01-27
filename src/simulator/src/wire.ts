/* eslint-disable no-multi-assign */
import { drawLine } from './canvasApi';
import { simulationArea } from './simulationArea';
import Node from './node';
import { updateSimulationSet, forceResetNodesSet } from './engine';
import { colors } from './themer/themer';

interface Scope {
    wires: Wire[];
    root: any; // Replace 'any' with the appropriate type if known
    timeStamp: number;
}

export default class Wire {
    objectType: string;
    node1: Node;
    node2: Node;
    scope: Scope;
    type: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;

    constructor(node1: Node, node2: Node, scope: Scope) {
        this.objectType = 'Wire';
        this.node1 = node1;
        this.scope = scope;
        this.node2 = node2;
        this.type = 'horizontal';

        this.x1 = this.node1.absX();
        this.y1 = this.node1.absY();
        this.x2 = this.node2.absX();
        this.y2 = this.node2.absY();
        this.updateData();
        this.scope.wires.push(this);
        forceResetNodesSet(true);
    }

    // Update wire coordinates
    updateData(): void {
        this.x1 = this.node1.absX();
        this.y1 = this.node1.absY();
        this.x2 = this.node2.absX();
        this.y2 = this.node2.absY();
        if (this.x1 === this.x2) this.type = 'vertical';
    }

    // Update scope and check connections
    updateScope(scope: Scope): void {
        this.scope = scope;
        this.checkConnections();
    }

    // Check if nodes are disconnected
    checkConnections(): boolean {
        const check =
            this.node1.deleted ||
            this.node2.deleted ||
            !(this.node1.connections?.includes(this.node2)) ||
            !(this.node2.connections?.includes(this.node1) ?? false);
        if (check) this.delete();
        return check;
    }

    // Handle double-click event
    dblclick(): void {
        if (
            this.node1.parent == globalScope.root &&
            this.node2.parent == globalScope.root
        ) {
            simulationArea.multipleObjectSelections = [this.node1, this.node2];
            simulationArea.lastSelected = undefined;
        }
    }

    // Update wire state
    update(): boolean {
        let updated = false;
        if (embed) return updated;

        this.updateWireType();
        updated = this.handleMouseInteraction() || updated;

        if (this.node1.deleted || this.node2.deleted) {
            this.delete();
            return updated;
        }

        if (!simulationArea.mouseDown) {
            updated = this.handleNodeAlignment() || updated;
        }

        return updated;
    }

    // Draw the wire
    draw(): void {
        const ctx = simulationArea.context;
        const color = this.getWireColor();
        drawLine(
            ctx,
            this.node1.absX(),
            this.node1.absY(),
            this.node2.absX(),
            this.node2.absY(),
            color,
            3
        );
    }

    // Check if a node lies on the wire
    checkConvergence(n: Node): boolean {
        return this.checkWithin(n.absX(), n.absY());
    }

    // Check if a coordinate lies on the wire
    checkWithin(x: number, y: number): boolean {
        const isHorizontal = this.type === 'horizontal';
        const isVertical = this.type === 'vertical';

        if (isHorizontal) {
            return y === this.node1.absY() && this.isBetween(x, this.node1.absX(), this.node2.absX());
        }

        if (isVertical) {
            return x === this.node1.absX() && this.isBetween(y, this.node1.absY(), this.node2.absY());
        }

        return false;
    }


    private isBetween(value: number, a: number, b: number): boolean {
        return value >= Math.min(a, b) && value <= Math.max(a, b);
    }

    // Add intermediate node between these two nodes
    converge(n: Node): void {
        this.node1.connect(n);
        this.node2.connect(n);
        this.delete();
    }

    // Delete the wire
    delete(): void {
        forceResetNodesSet(true);
        updateSimulationSet(true);
        this.removeMutualConnections();
        this.scope.wires = this.scope.wires.filter(x => x !== this);
        this.node1.checkDeleted();
        this.node2.checkDeleted();
        this.scope.timeStamp = Date.now();
    }
    
    // Add these helper methods
    private removeMutualConnections(): void {
        this.removeConnection(this.node1, this.node2);
        this.removeConnection(this.node2, this.node1);
    }
    
    private removeConnection(node: Node, otherNode: Node): void {
        if (node.connections) {
            node.connections = node.connections.filter(x => x !== otherNode);
        }
    }

    // Helper: Update wire type based on node positions
    private updateWireType(): void {
    const x1 = this.node1.absX();
    const x2 = this.node2.absX();
    const y1 = this.node1.absY();
    const y2 = this.node2.absY();

    if (x1 === x2) {
        this.x1 = this.x2 = x1;
        this.type = 'vertical';
    } else if (y1 === y2) {
        this.y1 = this.y2 = y1;
        this.type = 'horizontal';
    }
}

    // Helper: Handle mouse interactions
    private handleMouseInteraction(): boolean {
        if (this.checkWireSelection()) {
            simulationArea.selected = true;
            simulationArea.lastSelected = this;
            return true;
        }
    
        if (this.checkWireDrag()) {
            this.createIntermediateNode();
            return true;
        }
    
        return false;
    }
    
    // Add these helper methods
    private checkWireSelection(): boolean {
        return !simulationArea.shiftDown &&
            simulationArea.mouseDown &&
            !simulationArea.selected &&
            this.checkWithin(simulationArea.mouseDownX, simulationArea.mouseDownY);
    }
    
    private checkWireDrag(): boolean {
        return simulationArea.mouseDown &&
            simulationArea.lastSelected === this &&
            !this.checkWithin(simulationArea.mouseX, simulationArea.mouseY);
    }
    
    private createIntermediateNode(): void {
        const n = new Node(
            simulationArea.mouseDownX,
            simulationArea.mouseDownY,
            2,
            this.scope.root
        );
        n.clicked = true;
        n.wasClicked = true;
        simulationArea.lastSelected = n;
        this.converge(n);
    }

    // Helper: Handle node alignment
    private handleNodeAlignment(): boolean {
        if (this.type === 'horizontal') {
            return this.alignNodesAlongYAxis();
        }
        if (this.type === 'vertical') {
            return this.alignNodesAlongXAxis();
        }
        return false;
    }

    // Add these helper methods
    private alignNodesAlongYAxis(): boolean {
        return this.checkAndCreateNode(
            this.node1.absY(),
            this.y1,
            () => new Node(this.node1.absX(), this.y1, 2, this.scope.root),
            this.node2.absY(),
            this.y2,
            () => new Node(this.node2.absX(), this.y2, 2, this.scope.root)
        );
    }

    private alignNodesAlongXAxis(): boolean {
        return this.checkAndCreateNode(
            this.node1.absX(),
            this.x1,
            () => new Node(this.x1, this.node1.absY(), 2, this.scope.root),
            this.node2.absX(),
            this.x2,
            () => new Node(this.x2, this.node2.absY(), 2, this.scope.root)
        );
    }

    private checkAndCreateNode(
        current1: number,
        expected1: number,
        createNode1: () => Node,
        current2: number,
        expected2: number,
        createNode2: () => Node
    ): boolean {
        if (current1 !== expected1) {
            this.converge(createNode1());
            return true;
        }
        if (current2 !== expected2) {
            this.converge(createNode2());
            return true;
        }
        return false;
    }

    // Helper: Get wire color based on state
    private getWireColor(): string {
        if (simulationArea.lastSelected == this) {
            return colors['color_wire_sel'];
        }
        if (this.node1.value == undefined || this.node2.value == undefined) {
            return colors['color_wire_lose'];
        }
        if (this.node1.bitWidth == 1) {
            return [
                colors['color_wire_lose'],
                colors['color_wire_con'],
                colors['color_wire_pow'],
            ][this.node1.value + 1];
        }
        return colors['color_wire'];
    }
}