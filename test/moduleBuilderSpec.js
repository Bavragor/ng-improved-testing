describe('moduleBuilder service', function() {
    'use strict';

    /** @const */
    var nonMockableService = Object.freeze({aProperty: 'aValue'});

    /** @const */
    var mockableServiceA = Object.freeze({aMethod: angular.noop});

    /** @const */
    var mockableServiceB = Object.freeze({aMethod: angular.noop});


    /**
     * @constructor
     * @const
     */
    var AServiceConstructor = jasmine.createSpy();

    /** @const */
    var aServiceFactoryFactory = jasmine.createSpy().andCallFake(function() {
        return {};
    });

    /**
     * @constructor
     * @const
     */
    var aControllerConstructor = jasmine.createSpy();

    /** @const */
    var $getProviderFactory = jasmine.createSpy().andCallFake(function() {
        return {};
    });

    var aFilterFactory = jasmine.createSpy().andCallFake(function() {
        return function(input) {
            return input;
        };
    });

    /** @const */
    var originalModuleInstance = angular.module('moduleBuilderSpecModule', ['ngResource'])
        .value('nonMockableService', nonMockableService)
        .value('mockableServiceA', mockableServiceA)
        .value('mockableServiceB', mockableServiceB)
        .factory('aServiceFactory',
                ['nonMockableService', 'mockableServiceA', 'mockableServiceB', aServiceFactoryFactory])
        .service('aServiceService',
                ['nonMockableService', 'mockableServiceA', 'mockableServiceB', AServiceConstructor])
        .provider('aServiceProvider', {
            $get: ['nonMockableService', 'mockableServiceA', 'mockableServiceB', $getProviderFactory]
        })
        .filter('aFilter', ['nonMockableService', 'mockableServiceA', 'mockableServiceB', aFilterFactory])
        .controller('aController',
                ['nonMockableService', 'notToBeMockedService', 'toBeMockedService', aControllerConstructor]);


    var moduleBuilder;

    var createdInjector = null;
    var moduleIntrospectorInstance = null;


    beforeEach(function() {
        var ngModuleIntrospectorInjector = angular.injector(['ngModuleIntrospector']);
        var originalModuleIntrospector = ngModuleIntrospectorInjector.get('moduleIntrospector');

        var ngImprovedTestingInjector = angular.injector(['ngImprovedTesting', function($provide) {
            var spiedModuleIntrospector = jasmine.createSpy().andCallFake(function() {
                var result = originalModuleIntrospector.apply(this, arguments);

                moduleIntrospectorInstance = result;

                for (var propertyName in result) {
                    if (result.hasOwnProperty(propertyName) && angular.isFunction(result[propertyName])) {
                        spyOn(result, propertyName).andCallThrough();
                    }
                }

                return result;
            });

            $provide.value('moduleIntrospector', spiedModuleIntrospector);
        }]);

        moduleBuilder = ngImprovedTestingInjector.get('moduleBuilder');

        var originalInjectorFn = angular.injector;
        spyOn(angular, 'injector').andCallFake(function() {
            var result = originalInjectorFn.apply(this, arguments);

            createdInjector = result;

            return result;
        });
    });

    afterEach(function() {
        createdInjector = null;
        moduleIntrospectorInstance = null;
    });



    describe('forModule method', function() {

        it('should throw some exception when an angular module does not exist', function() {
            expect(function() {
                moduleBuilder.forModule('nonExistingModule');
            }).toThrow();
        });

        it('should create a builder object', function() {
            var result = moduleBuilder.forModule(originalModuleInstance.name);

            expect(angular.isObject(result)).toBe(true);
            expect(angular.isFunction(result.build)).toBe(true);
        });

        it('should create an angular injector for ["ng", <module-name>]', function() {
            moduleBuilder.forModule(originalModuleInstance.name);

            expect(createdInjector).toBeDefined();
            expect(angular.injector).toHaveBeenCalledWith(['ng', originalModuleInstance.name]);
        });

        it('should create a module introspector', function() {
            moduleBuilder.forModule(originalModuleInstance.name);

            expect(moduleIntrospectorInstance).toBeDefined();
        });

    });



    describe('ngImprovedTesting.ModuleBuilder', function() {

        function testMockingOfDependenciesOfConstantAndValueServicesIsNotAllowed(methodName) {
            originalModuleInstance.constant('aConstant', 'aConstantValue');
            originalModuleInstance.constant('aValue', 'aValueValue');

            var moduleBuilderInstance = moduleBuilder.forModule(originalModuleInstance.name);

            expect(function() {
                moduleBuilderInstance[methodName]('aConstant');
            }).toThrow('Services declared with "contact" or "value" are not supported');

            expect(function() {
                moduleBuilderInstance[methodName]('aValue');
            }).toThrow('Services declared with "contact" or "value" are not supported');
        }

        function assertMockableDepenciesWereMocked(
                declaration, expectMockableServiceAMocked, expectMockableServiceBMocked) {
            expect(declaration).toHaveBeenCalled();
            expect(declaration.mostRecentCall.args.length).toBe(3);
            expect(declaration.mostRecentCall.args[0]).toBe(nonMockableService);

            if (expectMockableServiceAMocked) {
                expect(declaration.mostRecentCall.args[1]).not.toBe(mockableServiceA);
                expect(jasmine.isSpy(declaration.mostRecentCall.args[1].aMethod)).toBe(true);
            } else {
                expect(declaration.mostRecentCall.args[1]).toBe(mockableServiceA);
            }

            if (expectMockableServiceBMocked) {
                expect(declaration.mostRecentCall.args[2]).not.toBe(mockableServiceB);
                expect(jasmine.isSpy(declaration.mostRecentCall.args[2].aMethod)).toBe(true);
            } else {
                expect(declaration.mostRecentCall.args[2]).toBe(mockableServiceB);
            }
        }


        describe('serviceWithMocks method', function() {

            it('should throw an exception when invoke for "constant" as well as "value" service', function() {
                testMockingOfDependenciesOfConstantAndValueServicesIsNotAllowed('serviceWithMocks');
            });

            it('should return the module builder instance', function() {
                var moduleBuilderInstance = moduleBuilder.forModule(originalModuleInstance.name);

                var result = moduleBuilderInstance.serviceWithMocks('aServiceFactory');

                expect(result).toBe(moduleBuilderInstance);
            });


            describe('when build() is invoked', function() {

                it('should mock all mockable dependencies', function() {
                    moduleBuilder.forModule(originalModuleInstance.name)
                        .serviceWithMocks('aServiceFactory')
                        .build();

                    inject(function(aServiceFactory) {
                        expect(aServiceFactory).toBeDefined();
                        assertMockableDepenciesWereMocked(aServiceFactoryFactory, true, true);
                    });
                });

                it('should support mocking dependencies of a "service" registered service', function() {
                    moduleBuilder.forModule(originalModuleInstance.name)
                        .serviceWithMocks('aServiceService')
                        .build();

                    inject(function(aServiceService) {
                        assertMockableDepenciesWereMocked(AServiceConstructor, true, true);
                        expect(aServiceService instanceof AServiceConstructor).toBe(true);
                    });
                });

                //TODO: add support for "angular.Module#provider" registered services
                xit('should support mocking dependencies of a "provider" registered service', function() {
                    moduleBuilder.forModule(originalModuleInstance.name)
                        .serviceWithMocks('aServiceProvider')
                        .build();

                    inject(function(aServiceProvider) {
                        expect(aServiceProvider).toBeDefined();
                        assertMockableDepenciesWereMocked($getProviderFactory, true, true);
                    });
                });
            });
        });


        describe('serviceWithMocksFor method', function() {

            it('should throw an exception when invoke for "constant" as well as "value" service', function() {
                testMockingOfDependenciesOfConstantAndValueServicesIsNotAllowed('serviceWithMocksFor');
            });

            it('should return the module builder instance', function() {
                var moduleBuilderInstance = moduleBuilder.forModule(originalModuleInstance.name);

                var result = moduleBuilderInstance.serviceWithMocksFor('aServiceFactory', 'toBeMockedService');

                expect(result).toBe(moduleBuilderInstance);
            });

            describe('when build() is invoked', function() {

                it('only a explicitly specified dependency should be mocked when its mockable', function() {
                    moduleBuilder.forModule(originalModuleInstance.name)
                        .serviceWithMocksFor('aServiceFactory', 'mockableServiceB')
                        .build();

                    inject(function(aServiceFactory) {
                        expect(aServiceFactory).toBeDefined();
                        assertMockableDepenciesWereMocked(aServiceFactoryFactory, false, true);
                    });
                });

                it('should throw exception when you explicitly want to mock a non-mockable service', function() {
                    expect(function() {
                        moduleBuilder.forModule(originalModuleInstance.name)
                            .serviceWithMocksFor('aServiceFactory', 'nonMockableService')
                            .build();
                    }).toThrow('Could not mock the dependency explicitly asked to mock: nonMockableService');
                });

                it('should support mocking dependencies of a "service" registered service', function() {
                    moduleBuilder.forModule(originalModuleInstance.name)
                        .serviceWithMocksFor('aServiceService', 'mockableServiceB')
                        .build();

                    inject(function(aServiceService) {
                        assertMockableDepenciesWereMocked(aServiceFactoryFactory, false, true);
                        expect(aServiceService instanceof AServiceConstructor).toBe(true);
                    });
                });

                //TODO: add support for "angular.Module#provider" registered services
                xit('should support mocking dependencies of a "provider" registered service', function() {
                    moduleBuilder.forModule(originalModuleInstance.name)
                        .serviceWithMocksFor('aServiceProvider', 'mockableServiceB')
                        .build();

                    inject(function(aServiceProvider) {
                        expect(aServiceProvider).toBeDefined();
                        assertMockableDepenciesWereMocked($getProviderFactory, false, true);
                    });
                });
            });
        });


        describe('serviceWithMocksExcept method', function() {

            it('should throw an exception when invoke for "constant" as well as "value" service', function() {
                testMockingOfDependenciesOfConstantAndValueServicesIsNotAllowed('serviceWithMocksExcept');
            });

            it('should return the module builder instance', function() {
                var moduleBuilderInstance = moduleBuilder.forModule(originalModuleInstance.name);

                var result = moduleBuilderInstance.serviceWithMocksExcept('aServiceFactory', 'toBeMockedService');

                expect(result).toBe(moduleBuilderInstance);
            });

            describe('when build() is invoked', function() {

                it('should mock all mockable dependencies except when provided to be excluded', function() {
                    moduleBuilder.forModule(originalModuleInstance.name)
                        .serviceWithMocksExcept('aServiceFactory', 'mockableServiceA')
                        .build();

                    inject(function(aServiceFactory) {
                        expect(aServiceFactory).toBeDefined();
                        assertMockableDepenciesWereMocked(aServiceFactoryFactory, false, true);
                    });
                });

                it('should ignore (not throw an exception) any non-mockable dependencies when provided to be ' +
                        'excluded', function() {
                    moduleBuilder.forModule(originalModuleInstance.name)
                        .serviceWithMocksExcept('aServiceFactory', 'mockableServiceA', 'nonMockableService')
                        .build();

                    inject(function(aServiceFactory) {
                        expect(aServiceFactory).toBeDefined();
                        assertMockableDepenciesWereMocked(aServiceFactoryFactory, false, true);
                    });
                });

                it('should support mocking dependencies of a "service" registered service', function() {
                    moduleBuilder.forModule(originalModuleInstance.name)
                        .serviceWithMocksExcept('aServiceService', 'mockableServiceA')
                        .build();

                    inject(function(aServiceService) {
                        assertMockableDepenciesWereMocked(aServiceFactoryFactory, false, true);
                        expect(aServiceService instanceof AServiceConstructor).toBe(true);
                    });
                });

                //TODO: add support for "angular.Module#provider" registered services
                xit('should support mocking dependencies of a "provider" registered service', function() {
                    moduleBuilder.forModule(originalModuleInstance.name)
                        .serviceWithMocksExcept('aServiceProvider', 'mockableServiceA')
                        .build();

                    inject(function(aServiceProvider) {
                        expect(aServiceProvider).toBeDefined();
                        assertMockableDepenciesWereMocked(aServiceFactoryFactory, false, true);
                    });
                });
            });
        });


        //TODO: also test "filterWithMocksFor", "filterWithMocksExcept" and "filterAsIs"
        describe('filterWithMocks method', function() {

            it('should return the module builder instance', function() {
                var moduleBuilderInstance = moduleBuilder.forModule(originalModuleInstance.name);

                var result = moduleBuilderInstance.filterWithMocks('aFilter');

                expect(result).toBe(moduleBuilderInstance);
            });

            describe('when build() is invoked', function() {

                it('should mock all mockable dependencies', function() {
                    moduleBuilder.forModule(originalModuleInstance.name)
                        .filterWithMocks('aFilter')
                        .build();

                    inject(function(aFilterFilter) {
                        expect(aFilterFilter).toBeDefined();
                        assertMockableDepenciesWereMocked(aFilterFactory, true, true);
                    });
                });
            });
        });


        //TODO: test "controllerWithMocksFor", "controllerWithMocksExcept" and "controllerAsIs"
    });

});