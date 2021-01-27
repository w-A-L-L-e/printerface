# This file is part of the Printrun suite.
#
# Printrun is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# Printrun is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with Printrun.  If not, see <http://www.gnu.org/licenses/>.
#
# Imported from http://www.benden.us/journal/2014/OS-X-Power-Management-No-Sleep-Howto/
# Copyright (c) Joseph Benden 2014

import ctypes
import CoreFoundation
import objc

def SetUpIOFramework():
    # load the IOKit library
    framework = ctypes.cdll.LoadLibrary(
        '/System/Library/Frameworks/IOKit.framework/IOKit')

    # declare parameters as described in IOPMLib.h
    framework.IOPMAssertionCreateWithName.argtypes = [
        ctypes.c_void_p,  # CFStringRef
        ctypes.c_uint32,  # IOPMAssertionLevel
        ctypes.c_void_p,  # CFStringRef
        ctypes.POINTER(ctypes.c_uint32)]  # IOPMAssertionID
    framework.IOPMAssertionRelease.argtypes = [
        ctypes.c_uint32]  # IOPMAssertionID
    return framework

def StringToCFString(string):
    # we'll need to convert our strings before use
    try:
        encoding = CoreFoundation.kCFStringEncodingASCII
    except AttributeError:
        encoding = 0x600
    string = string.encode('ascii')
    cfstring = CoreFoundation.CFStringCreateWithCString(None, string, encoding)
    return objc.pyobjc_id(cfstring.nsstring())

def AssertionCreateWithName(framework, a_type,
                            a_level, a_reason):
    # this method will create an assertion using the IOKit library
    # several parameters
    a_id = ctypes.c_uint32(0)
    a_type = StringToCFString(a_type)
    a_reason = StringToCFString(a_reason)
    a_error = framework.IOPMAssertionCreateWithName(
        a_type, a_level, a_reason, ctypes.byref(a_id))

    # we get back a 0 or stderr, along with a unique c_uint
    # representing the assertion ID so we can release it later
    return a_error, a_id

def AssertionRelease(framework, assertion_id):
    # releasing the assertion is easy, and also returns a 0 on
    # success, or stderr otherwise
    return framework.IOPMAssertionRelease(assertion_id)

def inhibit_sleep_osx(reason):
    no_idle = "NoIdleSleepAssertion"

    # Initialize IOKit framework
    if inhibit_sleep_osx.framework is None:
        inhibit_sleep_osx.framework = SetUpIOFramework()
    framework = inhibit_sleep_osx.framework

    # Start inhibition
    ret, a_id = AssertionCreateWithName(framework, no_idle, 255, reason)
    inhibit_sleep_osx.assertion_id = a_id
    return ret
inhibit_sleep_osx.framework = None

def deinhibit_sleep_osx():
    return AssertionRelease(inhibit_sleep_osx.framework,
                            inhibit_sleep_osx.assertion_id)
