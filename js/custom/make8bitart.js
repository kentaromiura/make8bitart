/*
* make8bitart.com
* author: jenn schiffer
* turn down for wut
*/

$(function() {

    /*** VARIABULLS ***/

    var ctx, pickerPaletteCtx, leftSide, topSide, xPos, yPos, resetSelectStart, saveSelection, rect, historyPointer;
    var drawHistory = [];

    var DOM = {
        $window : $(window),
        $body : $('body'),

        $header : $('#header'),
        $credits : $('#credits'),
        $toolbox : $('#toolbox'),
        $savebox : $('#savebox'),
        $colorbox : $('#colorbox'),
        $waiting : $('#wait'),

        $color : $('.color').not('.custom'),
        $colorCustom : $('.color.custom'),
        $colorPicker : $('#colorpicker'),
        $colorPickerPalette : $('#8bitcolors'),
        $colorPickerDemo : $('.color-demo'),
        $hex : $('#hex-color'),
        $dropper : $('#color-dropper'),

        $pencil : $('#pencil'),
        $paint : $('#paint'),

        $buttonNewCanvas : $('#new-canvas'),
        $buttonSaveFull : $('#save-full'),
        $buttonSaveSelection : $('#save-selection'),

        $pixelSizeInput : $('.pixel-size-input'),
        $pixelSizeDemoDiv : $('#pixel-size-demo'),

        $minimizedToolsList : $('#minimized-tools-list'),
        $draggydivs : $('.draggy'),
        $tips : $('.tip'),
        $saveInstruction : $('.instructions').slideUp(),

        $undo : $('#undo'),
        $redo : $('#redo'),
        $defaultPalette : $('#default-palette'),
        $dawnbringerPalette : $('#dawnbringer-palette'),
        $defaultPaletteSection : $('.default-palette'),
        $dawnbringerPaletteSection : $('.DawnBringer-palette'),
    };

    var mode = {
        dropper : false,
        drawing : false,
        save : false,
        paint : false,
        trill : true
    };

    var action = {
        draw : 'draw',
        fill : 'fill',
        index : 0
    };

    var windowCanvas = {
        height: DOM.$window.height(),
        width: DOM.$window.width(),
        background: 'url("assets/bg.png")'
    };

    var copy = {
        selectionOff : 'turn off selection',
        selectionOn : 'selection',
        fullPage : 'full page'
    };

    var classes = {
        selectionCanvas : 'selectionCanvas',
        current: 'current',
        currentTool: 'current-tool',
        dropperMode: 'dropper-mode',
        wait: 'wait'
    };

    var pixel = {
        color: 'rgba(0, 0, 0, 1)',
    };


    /*** OUTSIDE LIBRARY STUFF - DRAGGYDIVS ***/
    var onMinimizeToolsListClick = function(e) {
        var $this = $(this);
        var $elm = $this.data('draggy');
        $elm.draggyBits('restore');
        $this.parent().remove();
    };

    var onMinimize = function($elm) {
        var $a = $('<a>').html($elm.attr('title')).on('click', onMinimizeToolsListClick).data('draggy', $elm);
        $('<li></li>').append($a).appendTo(DOM.$minimizedToolsList);
    };

    DOM.$draggydivs.draggyBits({onMinimize:onMinimize});

    // if mouse up is on toolboxes, don't keep drawing
    DOM.$draggydivs.mouseup(function() {
        DOM.$canvas.off('mousemove');
    });



    /*** DRAGGY POSITIONS ***/

    DOM.$header.css({
        left: '200px',
        top : '20px'
    });
    DOM.$credits.css({
        left : '480px',
        top : '120px'
    });
    DOM.$toolbox.css({
        left : '30px',
        top : '120px'
    });
    DOM.$colorbox.css({
        left : '750px',
        top : '50px'
    });



    /*** FUNCTIONS WOWOWOW ***/

    /* canvas & drawing */

    var generateCanvas = function() {

        // drawing
        DOM.$canvas = $('<canvas id="canvas" width="' + windowCanvas.width + '" height="' + windowCanvas.height + '">Your browser doesn\'t support canvas. Boo-hiss.</canvas>');
        DOM.$canvas.css('background',windowCanvas.background);
        DOM.$body.prepend( DOM.$canvas );
        ctx = DOM.$canvas[0].getContext('2d');

        // selection save overlay
        DOM.$overlay = $('<canvas id="overlay" width="' + windowCanvas.width + '" height="' + windowCanvas.height + '"></canvas>');
        DOM.$overlay.css({
            background : 'none',
            position : 'absolute',
            top : 0,
            left : 0,
            display : 'none'
        });
        DOM.$body.prepend( DOM.$overlay );
        ctxOverlay = DOM.$overlay[0].getContext('2d');
        ctxOverlay.fillStyle = 'rgba(0,0,0,.5)';

        // restore webstorage data
        if ( canStorage() ) {
            drawFromLocalStorage();
        }
    };

    var resetCanvas = function(background) {

        if ( window.confirm('You cannot undo canvas resets. Are you sure you want to erase this entire drawing?') ) {
            ctx.clearRect(0, 0, DOM.$canvas.width(), DOM.$canvas.height());

            if ( background && background != 'rgba(0, 0, 0, 0)') {
                windowCanvas.background = background;
                ctx.fillStyle = background;
                ctx.fillRect(0,0,DOM.$canvas.width(),DOM.$canvas.height());
            }

            // reset history
            drawHistory = [];
            historyPointer = -1;
            DOM.$redo.attr('disabled', 'disabled');
            DOM.$undo.attr('disabled', 'disabled');
        }
    };

    var initpixel = function(size) {
        pixel.size = size;
        DOM.$pixelSizeDemoDiv.css({
            width : pixel.size,
            height: pixel.size
        });
        DOM.$pixelSizeInput.val(pixel.size);
    };

    var drawPixel = function(xPos, yPos, color) {
        ctx.beginPath();
        xPos = ( Math.ceil(xPos/pixel.size) * pixel.size ) - pixel.size;
        yPos = ( Math.ceil(yPos/pixel.size) * pixel.size ) - pixel.size;
        ctx.moveTo (xPos, yPos);
        ctx.fillStyle = color;
        ctx.lineHeight = 0;

        if ( color == 'rgba(0, 0, 0, 0)' ) {
            ctx.clearRect(xPos,yPos,pixel.size,pixel.size);
        }
        else {
            ctx.fillRect(xPos,yPos,pixel.size,pixel.size);
        }

    };

    var drawOnMove = function(e) {
        var hoverData = ctx.getImageData( e.pageX, e.pageY, 1, 1).data;
        var hoverRGB = getRGBColor(hoverData);

        if ( !areColorsEqual( hoverRGB, pixel.color) ) {
            drawPixel(e.pageX, e.pageY, pixel.color);
            pushToHistory(action.index, action.draw, e.pageX, e.pageY, hoverRGB, pixel.color);
        }
    };

    var touchDraw = function(e) {
        // for each finger in your fingers
        for ( var i = 0; i < e.touches.length; i++ ) {
            drawOnMove(e.touches[i]);
        }
    };

    var paint = function( initColor, paintColor, x, y ) {

        // bless u sweet prince @potch
        var position = [x, y];

        var viewed = {};
        var stack = [];

        var thisPixelData = ctx.getImageData( x, y, 1, 1).data;
        initColor = getRGBColor(thisPixelData);

        stack.push(position);

        function fill() {
            var iterations = 0;

            while (stack.length && iterations < 10000) {

                iterations++;
                var current = stack.pop();
                var x = current[0];
                var y = current[1];

                viewed[current] = true;

                var currentPixelData = ctx.getImageData( x, y, 1, 1).data;
                var currentColor = getRGBColor(currentPixelData);

                if ( areColorsEqual(initColor, currentColor) ) {
                    drawPixel(x, y, paintColor);
                    pushToHistory(action.index, action.fill, x, y, initColor, paintColor);

                    if ( (x - pixel.size) >= 0 && !viewed[ [x - pixel.size, y] ] ) {
                        stack.push([x-pixel.size, y]);
                    }
                    if ( (x + pixel.size) < windowCanvas.width && !viewed[ [x + pixel.size, y] ]) {
                        stack.push([x+pixel.size, y]);
                    }
                    if ( (y - pixel.size) >= 0 && !viewed[ [x, y - pixel.size] ] ) {
                        stack.push([x, y-pixel.size]);
                    }
                    if ( (y + pixel.size) < windowCanvas.height && !viewed[ [x, y + pixel.size] ]) {
                        stack.push([x, y+pixel.size]);
                    }

                }
            }
            if (stack.length) {
                setTimeout(fill, 10);
            }
        }

        // fill it up fill it up fill it up
        fill();
    };

    var canStorage = function() {
        try {
            return 'localStorage' in window && window.localStorage !== null;
        }
        catch (e) {
            return false;
        }
    };

    var drawFromLocalStorage = function() {
        var savedCanvas = localStorage.make8bitartSavedCanvas;
        if ( savedCanvas ) {
            var img = new Image();
            img.onload = function() {
                ctx.drawImage(img,0,0);
            };
            img.src = savedCanvas;
        }
    };

    var pushToHistory = function( actionIndex, actionType, x, y, rgbOriginal, rgbNew) {
        // push to drawHistory
        var pixelDrawn = {
            index : actionIndex,
            action : actionType,
            xPos : x,
            yPos : y,
            originalColor : rgbOriginal,
            newColor : rgbNew
        };
        drawHistory.push(pixelDrawn);
        historyPointer++;
        DOM.$undo.removeAttr('disabled');
    };

    var undoRedo = function(pointer, undoFlag) {
        var undoRedoColor, nextPointer;
        if ( undoFlag ) {
            undoRedoColor = drawHistory[pointer].originalColor;
            nextPointer = pointer - 1;
        }
        else {
            undoRedoColor = drawHistory[pointer].newColor;
            nextPointer = pointer + 1;
        }

        if ( drawHistory[pointer].action == action.fill && drawHistory[nextPointer] && drawHistory[pointer].index == drawHistory[nextPointer].index ) {
            if ( undoFlag ) {
                historyPointer--;
            }
            else {
                historyPointer++;
            }
            undoRedo(historyPointer, undoFlag);
        }

        drawPixel(drawHistory[pointer].xPos, drawHistory[pointer].yPos, undoRedoColor);
    };

    var resetModes = function() {
        if ( mode.dropper ) {
            DOM.$dropper.removeClass(classes.currentTool).removeAttr('style');
            DOM.$canvas.removeClass(classes.dropperMode);
            mode.dropper = false;

            if ( pixel.color == 'rgba(0, 0, 0, 0)' ) {
                backgroundIMG = windowCanvas.background;
            }
            else {
                backgroundIMG = 'none';
            }

            DOM.$pixelSizeDemoDiv.css('background-image', backgroundIMG);
            DOM.$colorPickerDemo.css({
                'background-image' : backgroundIMG,
                'background-color' : pixel.color
            });
            DOM.$hex.val(rgbToHex(pixel.color));
        }
        else if ( mode.save ) {
            DOM.$buttonSaveSelection.click();
        }
        mode.paint = false;
        DOM.$paint.removeClass(classes.currentTool);
        DOM.$pencil.removeClass(classes.currentTool);
    };

    var buildColorPickerPalette = function() {

        // turns palette into canvas
        pickerPaletteCtx = DOM.$colorPickerPalette[0].getContext('2d');
        var img = new Image();
            img.onload = function() {
                pickerPaletteCtx.drawImage(img,0,0);
            };
            // NOTE: prefix path to /assets/customcolors.png if this doesn't work
            img.src = '/assets/customcolors.png';
    };


    /* saving */

    var startSaveSelection = function(e) {
        saveSelection = {
            startX : e.pageX,
            startY : e.pageY
        };
    };

    var generateSaveSelection = function(e) {

        saveSelection.endX = e.pageX;
        saveSelection.endY = e.pageY;

        generateSelectionCanvas(saveSelection);
        DOM.$buttonSaveSelection.click();
    };

    var generateSelectionCanvas = function(coords) {

        // temporary canvas to save image
        DOM.$body.append('<canvas id="' + classes.selectionCanvas + '"></canvas>');
        var tempCanvas = $('#' + classes.selectionCanvas);
        var tempCtx = tempCanvas[0].getContext('2d');

        // set dimensions and draw based on selection
        var width = Math.abs(coords.endX - coords.startX);
        var height = Math.abs(coords.endY - coords.startY);
        tempCanvas[0].width = width;
        tempCanvas[0].height = height;

        var startX = Math.min( coords.startX, coords.endX );
        var startY = Math.min( coords.startY, coords.endY );

        if ( width && height ) {
            tempCtx.drawImage(DOM.$canvas[0],startX, startY, width, height, 0, 0, width, height);

            // write on screen
            var img = tempCanvas[0].toDataURL('image/png');
            window.open(img,'_blank');
        }

        // remove tempCanvas
        tempCanvas.remove();
    };

    var drawSelection = function(e) {
        rect.w = (e.pageX - this.offsetLeft) - rect.startX;
        rect.h = (e.pageY - this.offsetTop) - rect.startY ;
        ctxOverlay.clearRect(0,0,DOM.$overlay.width(),DOM.$overlay.height());
        ctxOverlay.fillStyle = 'rgba(0,0,0,.5)';
        ctxOverlay.fillRect(0,0,DOM.$overlay.width(),DOM.$overlay.height());
        ctxOverlay.clearRect(rect.startX, rect.startY, rect.w, rect.h);
    };

    var saveToLocalStorage = function() {
        if ( canStorage() ) {
            savedCanvas = DOM.$canvas[0].toDataURL('image/png');
            localStorage.make8bitartSavedCanvas = savedCanvas;
        }
    };


    /* colors */

    var getRGBColor = function(imageData) {
        var opacity = imageData[3]/255;
        return 'rgba(' + imageData[0] + ', ' + imageData[1] + ', ' + imageData[2] + ', ' + opacity + ')';
    };

    var rgbToHex = function( rgb ) {
        if ( rgb.charAt(0) == '#' ) {
            return rgb.slice(1,7);
        }

        if ( rgb == 'transparent' ) {
            return null;
        }

        var startString = ( rgb.charAt(3) == 'a' ) ? 5 : 4;
        var rgbArray = rgb.substr(startString, rgb.length - 5).split(',');
        var hex = '';
        for ( var i = 0; i <= 2; i++ ) {
            var hexUnit = parseInt(rgbArray[i]).toString(16);
            if ( hexUnit.length == 1 ) {
                hexUnit = '0' + hexUnit;
            }
            hex += hexUnit;
        }
        return hex;
    };

    var setDropperColor = function( color ) {
        pixel.color = color;
        DOM.$pixelSizeDemoDiv.css('background-image', 'none');
        DOM.$colorPickerDemo.css('background-image', 'none');
        DOM.$pixelSizeDemoDiv.css('background-color', pixel.color);
        DOM.$colorPickerDemo.css('background-color', pixel.color);
        DOM.$hex.val(rgbToHex(DOM.$colorPickerDemo.css('background-color')));
        DOM.$draggydivs.css('box-shadow','5px 5px 0 ' + pixel.color);
    };

    var hexColorChosen = function() {
        var newColor = '#' + DOM.$hex.val();
        $('.current').removeClass(classes.current);
        DOM.$hex.addClass(classes.current);

        pixel.color = newColor;
        DOM.$colorPickerDemo.css('background-color', newColor);
        DOM.$draggydivs.css('box-shadow','5px 5px 0 ' + newColor);
    };

    var areColorsEqual = function( alpha, beta ) {

        if ( ( alpha == 'rgba(0, 0, 0, 0)' && ( beta == '#000000' || beta == 'rgba(0, 0, 0, 1)' ) ) ||
            ( ( alpha == '#000000' || alpha == 'rgba(0, 0, 0, 1)' ) && beta == 'rgba(0, 0, 0, 0)' )  ||
             rgbToHex(alpha) != rgbToHex(beta) ) {
            return false;
        }
        else {
            return true;
        }
    };

    /*** EVENTS OH MAN ***/

    /* general */

    var onMouseDown = function(e) {
        e.preventDefault();

        var origData = ctx.getImageData( e.pageX, e.pageY, 1, 1).data;
        var origRGB = getRGBColor(origData);

        if ( mode.dropper ) {
            mode.dropper = false;
            setDropperColor( origRGB );
            DOM.$canvas.removeClass(classes.dropperMode);
            DOM.$dropper.removeClass(classes.currentTool).removeAttr('style');
        }
        else if ( !mode.save ) {

            // reset history
            drawHistory = drawHistory.slice(0, historyPointer+1);
            DOM.$redo.attr('disabled','disabled');

            if ( mode.paint && !areColorsEqual( origRGB, pixel.color ) ) {
                action.index++;
                paint( origRGB, pixel.color, e.pageX, e.pageY);
            }
            else {
                // draw mode
                mode.drawing = true;

                action.index++;
                drawPixel(e.pageX, e.pageY, pixel.color);

                if ( !areColorsEqual( origRGB, pixel.color) ) {
                    pushToHistory(action.index, action.draw, e.pageX, e.pageY, origRGB, pixel.color);
                }

                DOM.$canvas.on('mousemove', drawOnMove);

                // touch
                DOM.$canvas[0].addEventListener('touchmove', touchDraw, false);
            }

        }
        else {
            // overlay stuff
            rect = {};
            startSaveSelection(e);
            rect.startX = e.pageX - this.offsetLeft;
            rect.startY = e.pageY - this.offsetTop;
            DOM.$overlay.on('mousemove', drawSelection);

            // touch
            DOM.$overlay[0].addEventListener('touchmove', drawSelection, false);
        }
    };

    var onMouseUp = function(e) {

        if ( !mode.save ) {
            DOM.$canvas.off('mousemove');
            mode.drawing = false;

            // save
            saveToLocalStorage();
        }
        else {
            DOM.$overlay.off('mousemove');
            ctxOverlay.clearRect(0,0,DOM.$overlay.width(),DOM.$overlay.height());
            generateSaveSelection(e);
            mode.save = false;
            rect = {};
        }
    };


    /* tools */

    // draw clicked
    DOM.$pencil.click(function(e) {
        e.preventDefault();
        resetModes();
        $(this).addClass(classes.currentTool);
    });

    // paint clicked
    DOM.$paint.click(function(e) {
        e.preventDefault();
        resetModes();
        $(this).addClass(classes.currentTool);
        mode.paint = true;
    });

    // pixel size slider changed
    DOM.$pixelSizeInput.change(function() {
        pixel.size = $(this).val();
        DOM.$pixelSizeDemoDiv.css({
            width : pixel.size,
            height : pixel.size
        });

        // set both inputs to be equal
        DOM.$pixelSizeInput.val(pixel.size);
    });

    // reset canvas
    DOM.$buttonNewCanvas.click(function() {
        resetCanvas( pixel.color );
        saveToLocalStorage();
    });

    // save full canvas
    DOM.$buttonSaveFull.click(function() {
        var savedPNG = DOM.$canvas[0].toDataURL('image/png');
        window.open(savedPNG,'_blank');
    });

    // save selection of canvas button clicked
    DOM.$buttonSaveSelection.click(function() {
        if ( mode.save ) {
            mode.save = false;
            DOM.$saveInstruction.slideUp();
            $(this).val(copy.selectionOn);
            DOM.$overlay.hide();
        }
        else {
            mode.save = true;
            DOM.$saveInstruction.slideDown();
            $(this).val(copy.selectionOff);
            ctxOverlay.fillRect(0,0,DOM.$overlay.width(),DOM.$overlay.height());
            DOM.$overlay.show();
        }
    });

    // ensure elements are enabled before triggering a click event
    var triggerClickForEnabled = function(elem) {
        return function() {
            // no-op if there is nothing to undo
            if (elem.is(':disabled')) {
                return;
            }

            // trigger the click
            elem.trigger('click');
        };
    };

    // undo
    DOM.$undo.click(function() {
        undoRedo(historyPointer, true);
        historyPointer--;

        DOM.$redo.removeAttr('disabled');

        if ( historyPointer < 0 ) {
            DOM.$undo.attr('disabled', 'disabled');
        }
    });

    // redo
    DOM.$redo.click(function() {
        historyPointer++;
        undoRedo(historyPointer, false);

        DOM.$undo.removeAttr('disabled');
        if ( historyPointer == drawHistory.length - 1 ) {
            DOM.$redo.attr('disabled', 'disabled');
        }
    });

    // undo alias to ctrl+z, macs aliased to cmd+z
    key('ctrl+z, ⌘+z', triggerClickForEnabled(DOM.$undo));

    // redo alias to ctrl+y and mac aliased cmd+shift+z
    key('ctrl+y, ⌘+shift+z', triggerClickForEnabled(DOM.$redo));


    /* colors */

    // choose color
    DOM.$color.click(function() {

        var $newColor = $(this);
        var newColorLabel = $newColor.attr('data-color');
        var demoColor;

        $('.current').removeClass(classes.current);
        $newColor.addClass(classes.current);
        pixel.color = newColorLabel;

        if ( pixel.color != 'rgba(0, 0, 0, 0)' ) {
            demoColor = pixel.color;
            DOM.$pixelSizeDemoDiv.css('background-image', 'none');
            DOM.$colorPickerDemo.css('background-image', 'none');
        }
        else {
            DOM.$pixelSizeDemoDiv.css('background-image', windowCanvas.background);
            DOM.$colorPickerDemo.css('background-image', windowCanvas.background);
            DOM.$hex.val('');
        }
        DOM.$pixelSizeDemoDiv.css('background-color', demoColor);
        DOM.$colorPickerDemo.css('background-color', demoColor);
        DOM.$hex.val(rgbToHex(DOM.$colorPickerDemo.css('background-color')));
        DOM.$draggydivs.css('box-shadow','5px 5px 0 ' + newColorLabel);
    });

    // custom color picker started
    DOM.$colorCustom.click(function() {
        DOM.$colorPicker.slideToggle();
    });

    // custom color hover
    DOM.$colorPickerPalette.mouseover( function(e) {
        $(this).mousemove( mousemovePickerPalette );
    });

    DOM.$colorPickerPalette.mouseout( function(e) {
        $(this).unbind('mouseover');
        DOM.$colorPickerDemo.css('background-color', pixel.color);
        DOM.$hex.val(rgbToHex(DOM.$colorPickerDemo.css('background-color')));
    });

    var mousemovePickerPalette = function(e) {
        var boundingRect = DOM.$colorPickerPalette[0].getBoundingClientRect();
           var hoverData = pickerPaletteCtx.getImageData( e.pageX - boundingRect.left, e.pageY - boundingRect.top, 1, 1).data;
        var hoverRGB = getRGBColor(hoverData);
        DOM.$pixelSizeDemoDiv.css('background-image', 'none');
        DOM.$colorPickerDemo.css('background-image', 'none');
        DOM.$colorPickerDemo.css('background-color', hoverRGB);
        DOM.$hex.val(rgbToHex(hoverRGB));
    };

    // custom color chosen
    DOM.$colorPickerPalette.click(function(e) {
        var boundingRect = DOM.$colorPickerPalette[0].getBoundingClientRect();
           var clickData = pickerPaletteCtx.getImageData( e.pageX - boundingRect.left, e.pageY - boundingRect.top, 1, 1).data;
        var newColor = getRGBColor(clickData);
        $('.current').removeClass(classes.current);
        DOM.$colorCustom.addClass(classes.current);

        pixel.color = newColor;
        DOM.$colorPickerDemo.css('background-color', newColor);
        DOM.$draggydivs.css('box-shadow','5px 5px 0 ' + newColor);
    });

    // hex color input change
    DOM.$hex.keyup(hexColorChosen);
    DOM.$hex.focus(hexColorChosen);

    // color dropper clicked
    DOM.$dropper.click(function(e) {
        e.preventDefault();

        if ( DOM.$dropper.hasClass(classes.currentTool) ) {
            resetModes();
        }
        else {
            resetModes();
            mode.dropper = true;
            DOM.$dropper.addClass(classes.currentTool);
            DOM.$canvas.addClass(classes.dropperMode);

            DOM.$canvas.mousemove(function(e) {
                var hoverData = ctx.getImageData( e.pageX, e.pageY, 1, 1).data;
                var hoverRGB = getRGBColor(hoverData);
                DOM.$dropper.css('background-color', hoverRGB);

                DOM.$pixelSizeDemoDiv.css('background-image', 'none');
                DOM.$colorPickerDemo.css({
                    'background-image' : 'none',
                    'background-color' : hoverRGB
                });
                DOM.$hex.val(rgbToHex(hoverRGB));

            });
        }
    });


    /* misc */

    // tooltip hover
    DOM.$tips.hover(
        function() {
            $(this).find('.tip-text').stop().show();
        },
        function() {
            $(this).find('.tip-text').stop().hide();
        }
    );

    // canvas window size changes
    DOM.$window.resize(function() {
        if ( DOM.$window.width() <= windowCanvas.width && DOM.$window.height() <= windowCanvas.height ) {
            return;
        }
        else {
            // if local storage
            if ( !canStorage() || mode.save ) {
                return;
            }
            else {
                var newWidth = DOM.$window.width();
                var newHeight = DOM.$window.height();
                windowCanvas.width = newWidth;
                windowCanvas.height = newHeight;

                // save image
                saveToLocalStorage();

                DOM.$canvas
                    .attr('width',newWidth)
                    .attr('height',newHeight);
                DOM.$overlay
                    .attr('width',newWidth)
                    .attr('height',newHeight);
                ctxOverlay = DOM.$overlay[0].getContext('2d');
                ctxOverlay.fillStyle = 'rgba(0,0,0,.5)';

                // draw image
                drawFromLocalStorage();
            }

        }
    });


    DOM.$defaultPalette.click(function(){
      DOM.$defaultPaletteSection.removeClass("hidden")
      DOM.$dawnbringerPaletteSection.addClass("hidden")
    })

    DOM.$dawnbringerPalette.click(function(){
      DOM.$defaultPaletteSection.addClass("hidden")
      DOM.$dawnbringerPaletteSection.removeClass("hidden")
    })

    $('a', DOM.$dawnbringerPaletteSection).each(function(i, a){
      a.style.backgroundColor = a.dataset.color;
    })
    /*** INIT HA HA HA ***/
    generateCanvas();
    buildColorPickerPalette();
    initpixel(15);

    historyPointer = -1;

    DOM.$canvas.mousedown(onMouseDown).mouseup(onMouseUp);
    DOM.$overlay.mousedown(onMouseDown).mouseup(onMouseUp);

    //touch
    DOM.$canvas[0].addEventListener('touchstart', onMouseDown, false);
    DOM.$canvas[0].addEventListener('touchend', onMouseUp, false);
    DOM.$overlay[0].addEventListener('touchstart', onMouseDown, false);
    DOM.$overlay[0].addEventListener('touchend', onMouseUp, false);
});
