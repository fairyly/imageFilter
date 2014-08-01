KISSY.add(function (S, Node,Demo) {
    var $ = Node.all;
    describe('imagefilter', function () {
        it('Instantiation of components',function(){
            var demo = new Demo();
            expect(S.isObject(demo)).toBe(true);
        })
    });

},{requires:['node','kg/imagefilter/2.0.0/']});