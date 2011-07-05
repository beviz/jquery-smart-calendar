 /**
 * 支持鼠标滚轮、键盘方向键控制与键盘录入的时间插件
 * 
 * dependent: jquery & jquery.mousewheel & jquery.fieldselection
 * 
 * @author Bevis.Zhao
 * @time 2011/5/28 1:15PM
 */
(function(){
	
	/**
	 * Fill string to left , if the owner's length not enough
	 * Default fill 0
	 * @param {Object} shouldLength
	 * @param {Object} fill
	 */
	String.prototype.leftFill = function(length, fill){
		var difference = length - this.length,
			nu = [];
		while(0 < difference--)
			nu.push(fill || '0' );
		return nu.join('') + this;
	};
	
	/**
		 * 根据输入的ASCII码，获取数字
		 * @param {Number} keyCode
		 */
	var getCodeNumber = function(keyCode){
		if (keyCode >= 48 && keyCode <= 57) {
			return 0 - (48 - keyCode);
		} else if (keyCode >= 96 && keyCode <= 105){
			return 0 - (96 - keyCode);
		} else {
			return NaN;
		}
	};
	
	/**
	 * 获取区间数字，与是否在区间的结果
	 * 
	 * @param {Object} number
	 * @param {Object} min
	 * @param {Object} max
	 */
	var getRangeResult = function(n, min, max){
		return {
			legal : n >= min && n <= max,
			result : n >= min 
				? n <= max 
					? n 
					: max
				: min
		};
	}
		
	// 在日期格式中可以使用的各标签
	var marks = {
		year : 'yyyy',
		month : 'MM',
		day : 'dd',
		hour24 : 'HH',
		minute : 'mm',
		second : 'ss'
	};
	
	// 默认设置	
	var defaults = {
		step : {
			year : 1,
			month : 1,
			day : 1,
			hour24 : 1,
			minute : 1,
			second : 1
		}, 
		format : 'yyyy/MM/dd HH:mm:ss',
		// 最小日期
		min : {
			caculate : function() {
				return new Date(1900, 0, 1, 0, 0, 0);
			}
		},
		// 最大日期
		max : {
			caculate : function() {
				return new Date(9999, 11, 31, 23, 59, 59);
			}
		}
	};

	var SmartCalendar = function($target, time, options){
		this.$target = $target;
		this.time = time;
		this.options = options;
		this.format_expr = this.buildFormatExpr(options.format);
		this.offset = this.caculateOffset();
		this.initialize();
	}
	
	/**
	 * 添加属性
	 */
	$.extend(SmartCalendar.prototype, {
		initialize : function(){
			var thiz = this;
			
			// 初始化录入内容为空
			this.entered = [];
				
			// 创建替身
			this.$hidden = $('<input type="hidden" />').attr({
				name : this.$target.attr('name')
			}).removeAttr('name').insertAfter(this.$target);
			
			// 更新数据
			this.setValue();
			
			this.$target.focus(function(e){
				var $this = $(this);
				
				// 判断是否通过鼠标进入。
				// 若不是鼠标进入，则手动定位。
				// 否则，由mouseup进行定位
				if (!thiz.isMousedown) {
					// Webkit 不支持return false阻止全选，故使用定时。
					if ($.browser.webkit) {
						setTimeout(function(){
							// 移动到上次修改的位置
							thiz.movePointer();
						}, 10);
					} else {
						// 移动到上次修改的位置
						thiz.movePointer();
					}
					thiz.isMousedown = false;
				}
				// 设置主标
				$this.data('cursor', $this.css('cursor'))
					.css('cursor', 'n-resize');
					
				// 确保不会出现闭包问题
				var cthiz = thiz;
				// 添加windows滚动控制，达到不再框上也可滚动的效果
				$(document).bind('mousewheel', cthiz.globalMousewheel = function(){
					cthiz.mousewheel.apply(cthiz, arguments);
					return false;
				});
				
				return false;
			}).blur(function(e){
				// 还原鼠标
				var $this = $(this);
				$(this).css('cursor', $this.data('cursor'))
					.removeData('cursor');
				thiz.refreshInput();
				
				// 清理window滚动控制
				$(document).unbind('mousewheel', thiz.globalMousewheel);
				delete thiz.globalMousewheel;
			}).mousewheel(function(){
				thiz.mousewheel.apply(thiz, arguments);
				return false;
			}).keydown(function(){
				return thiz.keydown.apply(thiz, arguments);
			}).keyup(function(e){
				var num = getCodeNumber(e.keyCode);
				(!isNaN(num)) && thiz.input(num); 
				thiz.isKeydown = false;
			}).mousedown(function() {
				thiz.isMousedown = true;
				// 在输入框内且已经输入部分数字后点击文本框，需要刷新内容
				if (thiz.entered.length != 0) {
					thiz.updateTime(thiz.pointer, thiz.entered.join(''), 0);
					thiz.entered = [];
				}
			}).mousemove(function(){return false;}).mouseup(function(e){
				thiz.isMousedown = false;
				return thiz.mouseup.apply(thiz, arguments);
			// 禁止拖拽操作
			}).bind('contextmenu drop dragover dragenter dragleave paste enterstart', function(){
				return false;
			});
		},
		
		/**
		 * 返回格式化后的日期时间
		 * 
		 * @param {Date} time
		 * @param {String} format_expr
		 */
		formatTime : function(){
			var values = {}, result = this.format_expr, time = this.time;
			
			values[marks.year] = time.getFullYear(),
			values[marks.month] = (time.getMonth() + 1).toString().leftFill(2, 0);
			values[marks.day] = time.getDate().toString().leftFill(2, 0);
			values[marks.hour24] = time.getHours().toString().leftFill(2, 0);
			values[marks.minute] = time.getMinutes().toString().leftFill(2, 0);
			values[marks.second] = time.getSeconds().toString().leftFill(2, 0);
			
			for (var p in values) {
				result = result.replace(new RegExp('\{' + p + '\}', 'g'), values[p]);
			}
			return result;
		},
		
		/**
		 * 滚轮滚动时计算
		 * 
		 * @param {Object} event
		 * @param {Object} delta
		 */
		mousewheel : function(event, delta){
			this.caculateTime(delta * this.options.step[this.pointer]);
		},
		
		/**
		 * 鼠标点击进行定位
		 * 
		 * @param {Event} event
		 */
		mouseup : function(event){
			// 光标所属mark
			var hostMark = null, selection = this.$target.getSelection();
			
			// 光标位置在最后，则选择最后一个。
			// 比较常用，所以单摘出来
			if (selection.start > this.offset.index[this.offset.sequence[this.offset.sequence.length - 1]].start) {
				hostMark = this.offset.sequence[this.offset.sequence.length - 1];
			} else {
				for (var i = 0; i < this.offset.sequence.length; i++) {
					var mark = this.offset.sequence[i];
					var v = this.offset.index[mark];
					// 在区间内
					if (v.start <= selection.start && v.start + v.length >= selection.start) {
						hostMark = mark;
						break;
						
					// 不在区间内但是在value内。
					// 如：06月07日 12:24，光标在“日| 12”，则选中日
					} else if (v.start > selection.start) {
						var prevMark = this.offset.sequence[i - 1];
						hostMark = prevMark;
						break;
					}
				}
			}
			if (this.pointer == hostMark) {
				this.movePointer();
				return false;
			} else {
				this.pointer = hostMark;
				this.movePointer();
				return true;
			}
		},
		
		/**
		 * 用户手动输入
		 */
		input : function(num){
			var length = this.offset.index[this.pointer].length;
			this.entered.push(num);
			
			if (this.entered.length == length) {
				this.refreshInput(+1);
			}
		},
		
		/**
		 * 刷新输入的输入
		 * 
		 */
		refreshInput : function(pointTo){
			if (this.entered.length != 0) {
				var legal = this.updateTime(this.pointer, this.entered.join(''));
				this.entered = [];
				if (!!pointTo) {
					if (legal) {
						this.movePointer(pointTo);
					} else {
						this.movePointer(0);
					}
				}
			} else { 
				if (!!pointTo) {
					this.movePointer(pointTo);
				}
			}
		},
		
		/**
		 * 更新时间某一mark
		 * 
		 * @param mark 更新位置 year | month | etc.
		 * @param number 更新的时间，在超出正常范围后会设定范围内时间
		 * @param pointTo 移动位置 -1 | 0 | 1
		 */
		updateTime : function(mark, number){
			var legal;
			switch (mark) {
		        case "year" : {
					var range = getRangeResult(number, this.options.min.caculate().getFullYear(), this.options.max.caculate().getFullYear());
					this.time.setFullYear(range.result);
					legal = range.legal;
					break;
		        }
		        case "month" : {
					var range = getRangeResult(number, 1, 12);
	            	this.time.setMonth(range.result - 1);
					legal = range.legal;
					break;
				}
		        case "day" : {
					var range = getRangeResult(number, 1, new Date(this.time.getFullYear(), this.time.getMonth() + 1, 0).getDate());
		            this.time.setDate(range.result);
					legal = range.legal;
		            break;
		        }
		        case "hour24" : {
					var range = getRangeResult(number, 0, 23);
		            this.time.setHours(range.result);
					legal = range.legal;
		            break;
		        }
		        case "minute" : {
					var range = getRangeResult(number, 0, 59);
		            this.time.setMinutes(range.result);
					legal = range.legal;
		            break;
		        }
		        case "second" : {
					var range = getRangeResult(number, 0, 59);
		            this.time.setSeconds(range.result);
					legal = range.legal;
		            break;
		        }
				default : 
					throw new Error("unsupport mark");
		    }
			
			var caculateLegal = this.caculateValue();
			if (legal) {
				return caculateLegal;
			}
			
			return legal;
		},
		
		/**
		 * 更新数据
		 */
		setValue : function(){
			var value = this.formatTime();
			this.$target.val(value);
			this.$hidden.val(value);
		},
		
		/**
		 * 计算并更新数据
		 */
		caculateValue : function() {
			// 不得超出时间范围
			var t = this.time.getTime();
			this.time = getRangeResult(this.time, new Date(this.options.min.caculate()), new Date(this.options.max.caculate())).result;
			this.setValue();
			return this.time.getTime() === t;
		},
		
		/**
		 * 按键后的操作
		 */
		keydown : function(e) {
			switch(e.keyCode){
				case 8 : // BACKSPACE
					// 输入内容情况下允许退格
					if (this.entered.length != 0) {
						this.entered.pop();
						return true;
					} else {
						return false;
					}
				case 116 : // REFRESH
					return true;
				case 35 : // END
					this.refreshInput(this.offset.sequence[this.offset.sequence.length - 1]);
					return false;
				case 36 : // HOME
					this.refreshInput(this.offset.sequence[0]);
					return false;
				case 9 : // TAB
					// 如果按到了shift，那就按左方向处理
					if (e.shiftKey) {
						// 如果当前位置为第一个mark，则允许跳出
						if (this.pointer == this.offset.sequence[0]) {
							return true;
						} else {
							// 否则，按左方向处理
							e.keyCode = 37;
						}
					} else {
						// 如果当前位置为最后一个mark，则允许跳出
						if (this.pointer == this.offset.sequence[this.offset.sequence.length - 1]) {
							return true;
						} else {
							// 否则，按右方向处理
						}
					}
				case 37 : // Left
				case 13 : // Enter
				case 39 : // Right
					this.refreshInput(e.keyCode == 37 ? -1 : 1);
					return false;
				case 38 : // Up
					return this.caculateTime(+1 * this.options.step[this.pointer]) || false;
				case 40 : // down
					return this.caculateTime(-1 * this.options.step[this.pointer]) || false;
				default: {
					var num = getCodeNumber(e.keyCode);
					if(!isNaN(num)) {
						// 禁止连续按下
						if (this.isKeydown == true) {
							return false;
						}
						this.isKeydown = true;
						this.selection = this.$target.getSelection();
						this.lastValue = this.$target.val();
					} else {
						return false;
					}
				}
			}
		},
		
		/**
		 * 构建格式的运算表达式
		 * 
		 * @param {String} format
		 */
		buildFormatExpr : function () {
			var result = this.options.format;
			for (var p in marks) {
				result = result.replace(marks[p], '{' + marks[p] + '}');
			}
			return result;
		},
		
		/**
		 * 选中某一时间块
		 * @param {Object} mark
		 * @param {Number} p 1:right, 0:current, -1:left
		 */
		movePointer : function(p){
			var offset = this.offset;
			this.pointer = this.pointer || offset.sequence[0];
			// 传入的为mark
			if (typeof p == 'string' && !!marks[p]) {
				// 位置指向至mark处
				this.pointer = p;
				p = 0;
			}
			
			if (!p || p == 0) {
				;
			} else if (p == 1) {
				var index = offset.sequence_index[this.pointer];
				if (index == offset.sequence.length - 1) {
					this.pointer = offset.sequence[0];
				} else {
					this.pointer = offset.sequence[index + 1];
				}
			} else if (p == -1) {
				var index = offset.sequence_index[this.pointer];
				if (index == 0) {
					this.pointer = offset.sequence[offset.sequence.length - 1];
				} else {
					this.pointer = offset.sequence[index - 1];
				}
			}
			
			this.$target.setSelectionRange(offset.index[this.pointer].start, offset.index[this.pointer].length);
		},
		
		/**
		 * 根据当前所在mark，进行时间计算。用于滚轮和上下方向。
		 * 
		 * @param {Object} number
		 */
		caculateTime : function(number) {
			var date = this.time;
			switch (this.pointer) {
		        case "year" : {
					var d = date.getDate();
		            date.setFullYear(date.getFullYear() + number);
					// 天数越界
					if (date.getDate() < d) {
						// 还原月份
						date.setMonth(date.getMonth() - 1);
						// 设置为当月最大天数
						date.setDate(new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate());
					}
		            break;
		        }
		        case "month" : {
					var d = date.getDate();
		            this.time.setMonth(date.getMonth() + number);
					// 天数越界
					if (date.getDate() < d) {
						// 还原月份
						date.setMonth(date.getMonth() - 1);
						// 设置为当月最大天数
						date.setDate(new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate());
					}
		            break;
		        }
		        case "day" : {
		            this.time.setDate(date.getDate() + number);
		            break;
		        }
		        case "hour24" : {
		            this.time.setHours(date.getHours() + number);
		            break;
		        }
		        case "minute" : {
		            this.time.setMinutes(date.getMinutes() + number);
		            break;
		        }
		        case "second" : {
		            this.time.setSeconds(date.getSeconds() + number);
		            break;
		        }
				default : 
					throw new Error("unsupport mark");
		    }

			// 保证数据在区间内
			this.time = new Date(getRangeResult(this.time, new Date(this.options.min.caculate()), new Date(this.options.max.caculate())).result.getTime());
			// 更新数据，并保持高亮
			this.caculateValue();
			this.movePointer(0);
		}, 

		/**
		 * 根据格式，计算各自的位置
		 */ 
		caculateOffset : function(){
			// 添加标识符后用正则获取位置
			var result, index = 0, i, exprReg = /\{\w+\}/g, format = this.options.format;
			var results = {
				// 字符位置
				index : {}, 
				// 序列
				sequence : [],
				// 序列位置 
				sequence_index : {}
			};
			for (var p in marks) {
				if ((i = format.indexOf(marks[p])) != -1) {
					results.index[p] = {
						start : i,
						length : marks[p].length
					}
				}
			}
			
			// 计算序列及序列位置
			while ((result = exprReg.exec(this.format_expr)) != null) {
				result = result[0].replace(/\{/, '').replace(/\}/, '');
				for (var p in marks) {
					if (result == marks[p]) {
						results.sequence.push(p);
						results.sequence_index[p] = index ++;
					}
				}
			}
			return results;
		},
		api : {
			setTime : function(time){
				this.time = new Date(time);
				this.caculateValue();
			}, getTime : function(){
				return new Date(this.time);
			}
		}
	});
	
	// 设置为jQuery插件
	$.extend($.fn, {
		smartCalendar : function(method, options){
			// 是否为调用api
			if (typeof method == 'string') {
				var instance = this.data('calendar');
				if (!!instance) {
					var args = arguments, apiArgs = [];
					for (var i = 1; i < args.length; i++) {
						apiArgs.push(args[i]);
					}
					return instance.api[method].apply(instance, apiArgs);
				}
			} else {
				options = method;
			}
			
			// 合并选项
			options = $.extend(true, $.extend(true, {}, defaults), options || {});

			this.each(function(){
				var $this = $(this);
				// 使用value或者当前时间
				var time = new Date(), value = $this.attr('time');
				if (!!value) {
					time = new Date(parseInt(value));
				}
				$this.data('calendar', new SmartCalendar($(this), time, options));
			})
			// 屏蔽输入法
			.css('ime-mode', 'disabled');
			return this;
		} 
	});
})();