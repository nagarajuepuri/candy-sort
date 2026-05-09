var Game = function() {
    var colors = {
        blueViolet:    "#8A2BE2",
        brown:         "#A52A2A",
        burlyWood:     "#DEB887",
        cadetBlue:     "#5F9EA0",
        chocolate:     "#D2691E",
        darkBlue:      "#00008B",
        darkGoldenRod: "#B8860B",
        darkGrey:      "#A9A9A9",
        darkGreen:     "#006400",
        deepPink:      "#FF1493"
    };

    this.tubes = [];
    this.selectedTube = null;
    this.moves = 0;
    this.numColors = 0;
    this.boardId = null;
    this.activeColors = [];
    this.animating = false;

    this.init = function(level, gameBoardId) {
        if (level < 3 || level > 10) {
            console.error("Level must be between 3 and 10");
            return;
        }
        this.numColors = level;
        this.boardId = gameBoardId;
        this.selectedTube = null;
        this.moves = 0;
        this.animating = false;
        this.generateState();
        this.render({});
    };

    this.generateState = function() {
        var colorKeys = Object.keys(colors);
        this.activeColors = colorKeys.slice(0, this.numColors);

        var pool = [];
        for (var i = 0; i < this.activeColors.length; i++) {
            for (var j = 0; j < 4; j++) {
                pool.push(this.activeColors[i]);
            }
        }

        // Fisher-Yates shuffle
        for (var k = pool.length - 1; k > 0; k--) {
            var r = Math.floor(Math.random() * (k + 1));
            var tmp = pool[k]; pool[k] = pool[r]; pool[r] = tmp;
        }

        this.tubes = [];
        for (var t = 0; t < this.numColors; t++) {
            this.tubes.push(pool.slice(t * 4, t * 4 + 4));
        }
        this.tubes.push([]);
        this.tubes.push([]);
    };

    // anim: { lifted?: tubeIdx, liftCount?: N,
    //         flyOut?: tubeIdx, flyOutCount?: N,
    //         flyIn?: tubeIdx, flyInCount?: N }
    this.render = function(anim) {
        anim = anim || {};
        var board = document.getElementById(this.boardId);
        board.innerHTML = "";

        for (var i = 0; i < this.tubes.length; i++) {
            var tubeEl = document.createElement("div");
            tubeEl.className = "tube" + (this.selectedTube === i ? " selected" : "");
            tubeEl.dataset.index = i;

            var container = document.createElement("div");
            container.className = "candy-container";

            var stack = this.tubes[i];

            // Slot 3 = visual top (stack top), slot 0 = visual bottom
            for (var slot = 3; slot >= 0; slot--) {
                var candyEl = document.createElement("div");
                candyEl.className = "candy";

                var filled = slot < stack.length;
                if (filled) {
                    candyEl.style.backgroundColor = colors[stack[slot]];

                    // Determine how many top slots are in the animated group
                    var topSlot = stack.length - 1;          // index of top candy in stack
                    var slotDepthFromTop = topSlot - slot;   // 0 = topmost candy

                    if (anim.lifted === i && slotDepthFromTop < anim.liftCount) {
                        candyEl.className += " lifted";
                    }
                    if (anim.flyOut === i && slotDepthFromTop < anim.flyOutCount) {
                        candyEl.className += " fly-out";
                    }
                    if (anim.flyIn === i && slotDepthFromTop < anim.flyInCount) {
                        candyEl.className += " fly-in";
                    }
                }

                container.appendChild(candyEl);
            }

            tubeEl.appendChild(container);

            // Attach both touch and click — touch prevents 300ms ghost click
            (function(idx) {
                tubeEl.addEventListener("touchstart", function(e) {
                    e.preventDefault();
                    game1.handleTubeClick(idx);
                }, { passive: false });
                tubeEl.addEventListener("click", function() {
                    game1.handleTubeClick(idx);
                });
            }(i));

            board.appendChild(tubeEl);
        }

        var counter = document.getElementById("move-counter");
        if (counter) counter.textContent = "Moves: " + this.moves;

        var banner = document.getElementById("win-banner");
        if (banner) banner.style.display = "none";
    };

    this.countMovable = function(tubeIndex) {
        var tube = this.tubes[tubeIndex];
        if (tube.length === 0) return 0;
        var topColor = tube[tube.length - 1];
        var count = 0;
        for (var i = tube.length - 1; i >= 0; i--) {
            if (tube[i] === topColor) count++;
            else break;
        }
        return count;
    };

    this.canMove = function(from, to) {
        var fromTube = this.tubes[from];
        var toTube = this.tubes[to];
        if (fromTube.length === 0) return false;
        if (toTube.length >= 4) return false;
        if (toTube.length === 0) return true;
        return toTube[toTube.length - 1] === fromTube[fromTube.length - 1];
    };

    this.moveMultiple = function(from, to) {
        var movable = this.countMovable(from);
        var free = 4 - this.tubes[to].length;
        var count = Math.min(movable, free);
        for (var i = 0; i < count; i++) {
            this.tubes[to].push(this.tubes[from].pop());
        }
        this.moves++;
        return count;
    };

    this.handleTubeClick = function(index) {
        if (this.animating) return;

        if (this.selectedTube === null) {
            if (this.tubes[index].length > 0) {
                this.selectedTube = index;
                var liftCount = this.countMovable(index);
                this.render({ lifted: index, liftCount: liftCount });
            }
        } else if (this.selectedTube === index) {
            this.selectedTube = null;
            this.render({});
        } else {
            if (this.canMove(this.selectedTube, index)) {
                var from = this.selectedTube;
                var to = index;
                var flyOutCount = this.countMovable(from);
                this.selectedTube = null;
                this.animating = true;

                // Phase 1: fly-out at source (200ms)
                this.render({ flyOut: from, flyOutCount: flyOutCount });

                var self = this;
                setTimeout(function() {
                    // Phase 2: apply state, render with fly-in at destination
                    var moved = self.moveMultiple(from, to);
                    self.render({ flyIn: to, flyInCount: moved });
                    self.animating = false;
                    if (self.checkWin()) {
                        // Let fly-in finish before showing win
                        setTimeout(function() { self.showWin(); }, 310);
                    }
                }, 210);
            } else {
                this.selectedTube = null;
                this.render({});
            }
        }
    };

    this.checkWin = function() {
        for (var i = 0; i < this.tubes.length; i++) {
            var tube = this.tubes[i];
            if (tube.length === 0) continue;
            if (tube.length !== 4) return false;
            var first = tube[0];
            for (var j = 1; j < tube.length; j++) {
                if (tube[j] !== first) return false;
            }
        }
        return true;
    };

    this.showWin = function() {
        var banner = document.getElementById("win-banner");
        if (!banner) return;
        banner.innerHTML =
            '<div class="win-title">You won! 🎉</div>' +
            '<div class="win-sub">Sorted in ' + this.moves + ' move' + (this.moves === 1 ? '' : 's') + '</div>' +
            '<button id="win-new-game">Play Again</button>';
        banner.style.display = "block";
        var self = this;
        banner.querySelector("#win-new-game").addEventListener("click", function() {
            var levelSelect = document.getElementById("level-select");
            var level = levelSelect ? parseInt(levelSelect.value, 10) : 4;
            self.init(level, self.boardId);
        });
    };
};

var game1 = new Game();

document.addEventListener("DOMContentLoaded", function() {
    var levelSelect = document.getElementById("level-select");
    var newGameBtn = document.getElementById("new-game-btn");

    function startGame() {
        var level = levelSelect ? parseInt(levelSelect.value, 10) : 4;
        game1.init(level, "game-board");
    }

    if (newGameBtn) newGameBtn.addEventListener("click", startGame);
    if (levelSelect) levelSelect.addEventListener("change", startGame);

    startGame();
});
