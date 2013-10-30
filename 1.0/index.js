/**
 * @ImageFilter 
 * @author jiali<xiaofeng.mxf@taobao.com>
 * @module imageFilter
 **/
KISSY.add(function (S,Dom, Node,Base) {
    /**
     * 用于实现图像滤镜与处理，包括明度、饱和度、高斯模糊、做旧效果、四角压暗、灰度、切割等等。
     * @class ImageFilter
     * @constructor
     * @extends Base
     * @param  {object} comConfig 需要处理的原始img节点 { "imgNode": [HTMLElement] }
     */
    function ImageFilter(comConfig) {
        var _self = this;
        //调用父类构造函数
        ImageFilter.superclass.constructor.call(_self, comConfig);

        //image data class
        var TYPEMAP = {
            "r"    :  1,
            "g"    :  2,
            "b"    :  3,
            "a"    :  4,
            "rgb"  : -1,
            "rgba" : -2
        };

        var _imgNode  = comConfig.imgNode;
        _self._width    = _imgNode.width;
        _self._height   = _imgNode.height;
        var _canvas , _canvasCtx , _srcImgCanvasData , _srcImgData;

        function imgData(srcData,width,height){
            this.data   = srcData.data;
            this.width  = width;
            this.height = height;
        };

        imgData.prototype.getImageData = function(){
            return this.data;
        };

        imgData.prototype.getData = function(x,y,type){
            var typeOffset = TYPEMAP[type] || 1 ;
            var startPos   = ( (y - 1)* this.width + x - 1 ) * 4 - 1; //数组下标从0开始
            if(typeOffset > 0){ //r OR g OR b OR a
                var offset =  startPos + typeOffset ;
                return this.data[ offset ];
            }else if(typeOffset == -1){ //rgb
                var result = [];
                for(var i = startPos + 1 ; i <= startPos + 3 ; i++ ){
                    result.push(this.data[i]);
                }
                return result;
            }else{      //rgba
                var result = [];
                for(var i = startPos + 1 ; i <= startPos + 4 ; i++ ){
                    result.push(this.data[i]);
                }
                return result;
            }
        };

        imgData.prototype.setData = function(x,y,type,value){
            var typeOffset = TYPEMAP[type] || 1 ;
            var startPos   = ( (y - 1)* this.width + x - 1 ) * 4 - 1; //数组下标从0开始
            if(typeOffset > 0){
                var offset =  startPos + typeOffset ;
                this.data[offset] = value;
            }else if(typeOffset == -1 && value.length == 3){
                for(var i= 0 ; i <= 2 ; i++){
                    this.data[startPos + i + 1] = value[i];
                }
            }else if(typeOffset == -2 && value.length == 4){
                for(var i= 0 ; i <= 3 ; i++){
                    this.data[startPos + i + 1] = value[i];
                }
            }
        };   

        //create canvas
        _canvas = Dom.create('<canvas>',{
            css : {
                display:"none"
            }
        });
        _canvas.height = _self._height;
        _canvas.width  = _self._width;
        Dom.append(_canvas,"body");

        _canvasCtx = _canvas.getContext("2d");

        //get srcData
        _canvasCtx.drawImage(_imgNode,0,0,_self._width,_self._height);

        function _updateCanvasData(){
           _srcImgCanvasData = _canvasCtx.getImageData(0 , 0 , _self._width ,_self._height);
           _srcImgData       = new imgData(_srcImgCanvasData , _self._width ,_self._height); 
        }
        _updateCanvasData();

        function _updateCanvasDraw(){
            _canvasCtx.clearRect(0,0,_self._width,_self._height);
            _canvasCtx.putImageData( _srcImgCanvasData,0,0);
        }

        function _traversePixel(callback){
            for (var x = 1  ; x <= _self._width ; x++){
                for(var y = 1 ; y <= _self._height ; y++){
                    callback && callback( _srcImgData.getData(x,y,"rgb") , x ,y );
                }
            }
        }

        function _handleBrightness(originData,x,y,level){
            level = level / 100 + 1;
            var originHSL = rgbToHsl( originData );
            var finalRGB  = hslToRgb( [originHSL[0] , originHSL[1] , originHSL[2] * level] );
            _srcImgData.setData(x , y ,"rgb" , finalRGB);  // will auto fit to [0,255]
        }

        /**
         * 转换为灰度图
         * @param  {string} type 灰度计算方法，average/max/""(加权)
         * @return {_self}      _self
         */
        _self.gray = function(type){
            _traversePixel(function(originData,x,y){
                var grayData;
                if(type == "average"){
                    grayData = Math.round((originData[0] + originData[1] +  originData[2]) / 3);
                }else if(type == "max"){
                    grayData = Math.max(originData[0],originData[1],originData[2]);
                }else{
                    grayData = Math.round(originData[0] * 0.3 + originData[1] * 0.59  + originData[2] * 0.11);
                }
                _srcImgData.setData(x,y,"rgb",[grayData,grayData,grayData]);
            });

            _updateCanvasDraw();  
            return _self;
        };

        //level : -100 to +100
        //
        
        /**
         * 设置图片平均亮度
         * @method setBrightness
         * @param {number} level 亮度值,取[-100,100]
         */
        _self.setBrightness = function(level){
            _traversePixel(function(originData,x,y){
                _handleBrightness(originData,x,y,level);
            });

            _updateCanvasDraw();  
            return _self;
        };

      
        /**
         * 设置图片对比度
         * @method setContrast
         * @param {number} level        对比度等级，取值[-100,100]
         * @param {boolean} [ifCalAverage=false] 是否重新计算亮度值(更精准，但速度慢），false时取默认平均亮度为128
         */
        _self.setContrast = function(level, ifCalAverage){
            var average = 128;
            level /= 100;

            if(ifCalAverage){
                var sum = 0 ,count = 0;
                _traversePixel(function(originData,x,y){
                    sum += originData[0] * 0.3 + originData[1] * 0.59  + originData[2] * 0.11;
                    ++count;
                });
                average = sum / count;
            }
            
            //Average + (In – Average) * ( 1 + percent) ,http://blog.csdn.net/pizi0475/article/details/6740428
            _traversePixel(function(originRGB,x,y){
                var finalRGB  = [];
                finalRGB[0] = average + (originRGB[0] - average) * (1 + level); 
                finalRGB[1] = average + (originRGB[1] - average) * (1 + level); 
                finalRGB[2] = average + (originRGB[2] - average) * (1 + level); 
                _srcImgData.setData(x , y ,"rgb" , finalRGB);  // will auto fit to [0,255]
            });

            _updateCanvasDraw();
            return _self;
        };

        /**
         * 对图片做反色处理（负片效果）
         * @method reverse
         */
        _self.reverse = function(){
            _traversePixel(function(originRGB,x,y){
                var finalRGB = [];
                finalRGB[0] = 255 - originRGB[0];
                finalRGB[1] = 255 - originRGB[1];
                finalRGB[2] = 255 - originRGB[2];
                _srcImgData.setData(x , y ,"rgb" , finalRGB);  // will auto fit to [0,255]
            });

            _updateCanvasDraw();
            return _self;
        }

        /**
         * 对图片做四角压暗/变亮
         * @method  vignetting 
         * @param  {number} maxLevel 最边缘处的亮度值，[-100,100]
         * @param  {number} radius   中心半径值，默认为半宽度的0.35倍
         */
        _self.vignetting = function(maxLevel,radius){
            radius   = radius   || Math.max(_self._width , _self._height) * 0.30;
            maxLevel = maxLevel || -40;

            var centerX = _self._width  / 2;
            var centerY = _self._height / 2;
            var maxOffset = Math.sqrt(centerX * centerX + centerY * centerY) - radius;
            _traversePixel(function(originData,x,y){
                var centerDistanceSqr =  (x - centerX) * (x - centerX) + (y - centerY) * (y - centerY);
                if ( centerDistanceSqr <= (radius * radius) ) return;

                var offsetDistance = Math.sqrt(centerDistanceSqr) - radius;
                var currentLevel   = (offsetDistance / maxOffset) * (offsetDistance / maxOffset) * maxLevel;
                _handleBrightness(originData,x,y,currentLevel);

            });

            _updateCanvasDraw();  
            return _self;
        }


        // _self.autoTone = function(){
        // }

        /**
         * 设置图片透明度
         * @method setOpacity
         * @param {number} level 透明度，取值[0,1]
         */
        _self.setOpacity = function(level){
            var output = level * 255;
            _traversePixel(function(originData,x,y){
                var originOpacity = originData[3];
                _srcImgData.setData(x , y ,"a" , output);  // will auto fit to [0,255]
            });

            _updateCanvasDraw();
            return _self;
        };

        /**
         * 对图片做高斯模糊处理
         * @method blur 
         * @param  {number} [radius=1] 模糊半径，越大越模糊。必须为大于1的整数。
         */
        _self.blur = function(radius,sigma){
            sigma = 1.5 || sigma;

            var gaussianValue = function(x,y,sigma){
                x = Math.abs(x);
                y = Math.abs(y);
                return 1 / ( 2 * Math.PI * sigma * sigma ) * Math.exp( -(x*x + y*y) / (2 * sigma *sigma)  );
            }

            gaussinaCache = [];                
            for(var x = 0 ; x <= radius ; x++){
                for(var y = 0 ; y <=x ; y++){
                    gaussinaCache[x*x + y*y] = gaussianValue(x,y,sigma);
                }
            }
            //weight sum
            sum = 0;
            for(var x = -radius ; x <= radius ; x++){
                for(var y = -radius ; y <= radius ; y++){
                    sum += gaussinaCache[x*x + y*y];
                }
            }

            //update each weight
            for(var i = 0 ; i < gaussinaCache.length ; i++){
                gaussinaCache[i] && ( gaussinaCache[i] /= sum );
            }

            _traversePixel(function(originData,x,y){
                var finalRGB = [0 , 0 , 0];
                for( pointX = x - radius ; pointX <= (x + radius) ; ++pointX ){
                    for( pointY = y - radius ; pointY <= (y + radius) ; ++pointY ){
                        // debugger
                        var actualPointX ,actualPointY;
                        actualPointX = (pointX > 0       ? pointX        : (x + x - pointX) );
                        actualPointX = (pointX <= _self._width ? actualPointX  :  (x - (pointX-x)) );


                        actualPointY = (pointY > 0 ? pointY  : (y + y - pointY) );
                        actualPointY = (pointY <= _self._height ? actualPointY :  (y - (pointY-y)) );

                        var offsetX = Math.abs(x - actualPointX);
                        var offsetY = Math.abs(y - actualPointY);

                        var currentRGB = _srcImgData.getData( actualPointX , actualPointY ,"rgb");
                        for (var i = 0 ; i <= 2 ; i ++){
                            finalRGB[i] += currentRGB[i] * gaussinaCache[offsetX * offsetX + offsetY * offsetY];   
                        }
                    }
                }
                _srcImgData.setData(x , y ,"rgb" , finalRGB);  // will auto fit to [0,255]
            });

            _updateCanvasDraw();

            return _self;
        };

        /**
         * 对图片混入褐色，显做旧效果
         * @method mixBrown
         * @param  {Array} [customRGB=[208,163,79]] 自定义褐色的RGB值,默认[208,163,79]
         */
        _self.mixBrown = function(customRGB){
            _traversePixel(function(originData,x,y){
                var overlayRGB = customRGB || [208 ,163,79];
                // var overlayRGB = [224 ,193,137];
                var outputRGB  = [];
                outputRGB[0] = originData[0] < overlayRGB[0] ? originData[0] : overlayRGB[0];
                outputRGB[1] = originData[1] < overlayRGB[1] ? originData[1] : overlayRGB[1];
                outputRGB[2] = originData[2] < overlayRGB[2] ? originData[2] : overlayRGB[2];
                
                _srcImgData.setData(x , y ,"rgb" , outputRGB);  // will auto fit to [0,255]
            });

            _updateCanvasDraw();
            return _self;
        }

        /**
         * 混色(混合方法：变暗)
         * @method mixColor
         * @param  {Array} customRGB 需要混入的RGB值
         */
        _self.mixColor = function(customRGB){
            if(!customRGB) return;
            _traversePixel(function(originData,x,y){
                var outputRGB  = [];
                outputRGB[0] = originData[0] < customRGB[0] ? originData[0] : customRGB[0];
                outputRGB[1] = originData[1] < customRGB[1] ? originData[1] : customRGB[1];
                outputRGB[2] = originData[2] < customRGB[2] ? originData[2] : customRGB[2];
                
                _srcImgData.setData(x , y ,"rgb" , outputRGB);  // will auto fit to [0,255]
            });

            _updateCanvasDraw();
            return _self;
        }

        //线性光
        //完善中
        _self.light = function(customRGB){
            _traversePixel(function(originData,x,y){
                var overlayRGB = [24,65,41] ;
                var outputRGB  = [];
                outputRGB[0] = Math.min(255, Math.max(0, (overlayRGB[0] + 2 * originData[0]) - 1));
                outputRGB[1] = Math.min(255, Math.max(1, (overlayRGB[1] + 2 * originData[1]) - 1));
                outputRGB[2] = Math.min(255, Math.max(2, (overlayRGB[2] + 2 * originData[2]) - 1));               
                _srcImgData.setData(x , y ,"rgb" , outputRGB);  // will auto fit to [0,255]
            });

            _updateCanvasDraw();
            return _self;
        }


        /**
         * 切割图片
         * @method crop
         * @param  {number} x      起始位置的x坐标
         * @param  {number} y      起始位置的y坐标
         * @param  {number} width  切割宽度
         * @param  {number} height 切割高度
         */
        _self.crop = function(x,y,width,height){
            x = x || 0;
            y = y || 0;
            _self._width  =  Math.min( width   || _self._width  , _self._width - x ) ;
            _self._height =  Math.min( height  || _self._height , _self._height - y) ;
            _srcImgCanvasData  = _canvasCtx.getImageData(x,y,_self._width,_self._height);

            _canvas.width  = _self._width;
            _canvas.height = _self._height;
            _srcImgData    = new imgData(_srcImgCanvasData , _self._width ,_self._height);

            _updateCanvasDraw();
            return _self;
        }

        //TODO : degrees other than 0-90
        _self.rotate = function(degree){
            //canvas copy
            var tempCanvas    = Dom.create('<canvas>');

            tempCanvas.height = _self._height;
            tempCanvas.width  = _self._width;
            tempCanvas.getContext("2d").drawImage(_canvas,0,0);

            var rotateRad = degree * Math.PI/180;
            var newWidth  = Math.cos(rotateRad) * _self._width + Math.sin(rotateRad) * _self._height;
            var newHeight = Math.sin( Math.atan(_self._height / _self._width) + rotateRad ) * Math.sqrt( _self._width*_self._width + _self._height * _self._height );
            var offsetX   = Math.sin(rotateRad) * _self._height;

            _self._width  =  _canvas.width  = newWidth;
            _self._height =  _canvas.height = newHeight;

            _canvasCtx.clearRect(0,0,_self._width,_self._height);
            _canvasCtx.translate(offsetX,0);
            _canvasCtx.rotate(rotateRad);
            _canvasCtx.drawImage(tempCanvas,0,0);  //redraw with rotate

            _updateCanvasData();

            // _updateCanvasDraw();
            return _self;
        }

        /**
         * 获取图片Base64编码
         * @method getImageSrc
         * @return {string} base64编码后的png图片，可以用在img标签的src属性中。
         */
        _self.getImageSrc = function(){
            return _canvas.toDataURL("image/png");
        };

        /**
         * 渲染图片。只有在render后才能在界面上看到图像处理的结果。
         * @method render
         * @param  {HTMLElement} [target] 将图像渲染到target节点(其标签须是img)，默认为组建初始化时传入的节点
         */
        _self.render = function(target){
            target = target || _imgNode;
            target.src = _self.getImageSrc();
            return _self;
        };

        /**
         * 销毁组件
         * @method destroy 
         */
        _self.destroy = function(){
            Dom.remove(_canvas);
        };


        //from : https://gist.github.com/mjijackson/5311256
        /**
         * Converts an RGB color value to HSL. Conversion formula
         * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
         * Assumes r, g, and b are contained in the set [0, 255] and
         * returns h, s, and l in the set [0, 1].
         *
         * @param     Number    r             The red color value
         * @param     Number    g             The green color value
         * @param     Number    b             The blue color value
         * @return    Array                   The HSL representation
         */
        function rgbToHsl(rgbArr) {
            var r,g,b;
            r = rgbArr[0] / 255; g = rgbArr[1] / 255; b = rgbArr[2] / 255;

            var max = Math.max(r, g, b), min = Math.min(r, g, b);
            var h, s, l = (max + min) / 2;

            if (max == min) {
                h = s = 0; // achromatic
            } else {
                var d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

                switch (max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / d + 2; break;
                    case b: h = (r - g) / d + 4; break;
                }

                h /= 6;
            }

            return [ h, s, l ];
        }

        /**
         * Converts an HSL color value to RGB. Conversion formula
         * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
         * Assumes h, s, and l are contained in the set [0, 1] and
         * returns r, g, and b in the set [0, 255].
         *
         * @param   Number  h       The hue
         * @param   Number  s       The saturation
         * @param   Number  l       The lightness
         * @return  Array           The RGB representation
         */
        function hslToRgb(hslArr) {
            var h,s,l,r,g,b;
            h = hslArr[0]; s = hslArr[1]; l = hslArr[2];

            if (s == 0) {
                r = g = b = l; // achromatic
            } else {
                function hue2rgb(p, q, t) {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1/6) return p + (q - p) * 6 * t;
                    if (t < 1/2) return q;
                    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                    return p;
                }

                var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                var p = 2 * l - q;

                r = hue2rgb(p, q, h + 1/3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1/3);
            }

            return [ r * 255, g * 255, b * 255 ];
        }
          
    }
    S.extend(ImageFilter, Base, {

    }, {ATTRS :{

    }});
    return ImageFilter;
}, {requires:['dom','node', 'base']});



