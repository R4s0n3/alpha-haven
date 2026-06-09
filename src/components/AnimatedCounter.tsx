import millify from "millify";
import React from "react";

type AnimatedCounterProps = {
  value: number;
};

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ value }) => {
  const [displayValue, setDisplayValue] = React.useState(value);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setDisplayValue((currentValue) => {
        if (currentValue === value) {
          window.clearInterval(interval);
          return currentValue;
        }

        const difference = value - currentValue;
        const direction = Math.sign(difference);
        const step = Math.max(1, Math.ceil(Math.abs(difference) / 8));

        return currentValue + direction * Math.min(step, Math.abs(difference));
      });
    }, 50);

    return () => window.clearInterval(interval);
  }, [value]);

  return <span>{millify(displayValue)}</span>;
};

export default AnimatedCounter;
