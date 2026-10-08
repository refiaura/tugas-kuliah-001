package com.tugaskuliah.pos;

import org.hamcrest.Description;
import org.hamcrest.Matcher;
import org.hamcrest.TypeSafeMatcher;

/**
 * Test matchers for JSON numeric assertions.
 * Jackson serializes whole-number BigDecimals as integers (e.g., 12 not 12.0),
 * so standard {@code closeTo(double, double)} fails when the JSON contains an Integer.
 * This matcher accepts any {@link Number} and compares as double.
 */
public final class TestMatchers {

    private TestMatchers() {
    }

    public static Matcher<Object> closeToNumber(double expected, double error) {
        return new TypeSafeMatcher<>() {
            @Override
            protected boolean matchesSafely(Object actual) {
                if (!(actual instanceof Number n)) {
                    return false;
                }
                return Math.abs(n.doubleValue() - expected) <= error;
            }

            @Override
            public void describeTo(Description description) {
                description.appendText("a numeric value within ")
                        .appendValue(error)
                        .appendText(" of ")
                        .appendValue(expected);
            }

            @Override
            protected void describeMismatchSafely(Object actual, Description mismatch) {
                mismatch.appendText("was ").appendValue(actual);
            }
        };
    }
}
